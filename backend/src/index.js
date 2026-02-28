import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { buildFfmpegArgs, probeFile } from './services/ffmpeg.js';
import { formatConfig } from './config/formats.js';
import { saveStreamToFile, ensureDirs, removeFile, cleanupOldFiles } from './utils/fileUtils.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'outputs');

ensureDirs([UPLOAD_DIR, OUTPUT_DIR]);

const server = Fastify({ logger: true, trustProxy: true });

// Register plugins (no await - Fastify will wait before listening)
server.register(multipart, {
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB max upload
  }
});

server.register(cors, {
  origin: true
});

// In-memory job store (for demo). Use Redis/BullMQ for production.
const jobs = new Map();

// GET /health - simple health check
server.get('/health', async (req, reply) => {
  return { status: 'ok' };
});

// GET /api/formats - return available formats and their options
server.get('/api/formats', async (req, reply) => {
  return { formats: formatConfig };
});

// POST /api/convert - accept multipart file + options  
server.post('/api/convert', async (req, reply) => {
  let fileInfo = null;
  let fields = {};
  let inputPath = null;

  // Parse all multipart parts (both files and fields)
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      if (part.fieldname === 'file') {
        // Main uploaded audio file - save it immediately
        const id = uuidv4();
        const originalExt = path.extname(part.filename) || '';
        inputPath = path.join(UPLOAD_DIR, `${id}-input${originalExt}`);
        await saveStreamToFile(part.file, inputPath);
        fileInfo = { id, filename: part.filename, inputPath };
      } else if (part.fieldname === 'artwork') {
        // Optional artwork upload (cover image)
        const artId = uuidv4();
        const artExt = path.extname(part.filename) || '.jpg';
        const artworkPath = path.join(UPLOAD_DIR, `${artId}-artwork${artExt}`);
        await saveStreamToFile(part.file, artworkPath);
        // expose artwork path via a special field so the worker can pick it up
        fields._artworkPath = artworkPath;
      } else {
        // Other file fields (ignore)
        // consume stream already handled by saving above
      }
    } else {
      // This is a form field - get the value directly
      fields[part.fieldname] = part.value;
    }
  }

  if (!fileInfo) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  // Extract options from fields
  const format = (fields.format || 'mp3').toString().toLowerCase();
  const codec = (fields.codec || '').toString() || null;
  const sampleRate = (fields.sampleRate || '').toString() || null;
  const bitrate = (fields.bitrate || '').toString() || null;
  const bitDepth = (fields.bitDepth || '').toString() || null;
  const channels = (fields.channels || '').toString() || null;
  const compression = (fields.compression || '').toString() || null;
  const normalize = fields.normalize === 'true';

  server.log.info(`Convert request: format=${format}, codec=${codec}, sampleRate=${sampleRate}, bitrate=${bitrate}, bitDepth=${bitDepth}, channels=${channels}, compression=${compression}, normalize=${normalize}`);

  const id = fileInfo.id;
  // Use configured extension (e.g., 'm4a' for AAC) when available
  const formatExt = (formatConfig[format] && formatConfig[format].extension) ? formatConfig[format].extension : format;
  const outExt = `.${String(formatExt).replace('.', '')}`;
  const outputPath = path.join(OUTPUT_DIR, `${id}-output${outExt}`);

  // Probe metadata using ffprobe (best-effort)
  let metadata = null;
  try {
    metadata = await probeFile(inputPath);
  } catch (e) {
    server.log.warn('ffprobe failed:', e && e.message ? e.message : e);
  }

  // Parse metadata JSON if provided (from frontend editor)
  let metadataEdits = null;
  try {
    if (fields.metadata) metadataEdits = JSON.parse(fields.metadata);
  } catch (e) {
    server.log.warn('Failed to parse metadata edits JSON:', e && e.message ? e.message : e);
  }

  // Register job with metadata
  jobs.set(id, {
    id,
    status: 'queued',
    progress: 0,
    inputPath,
    outputPath,
    metadata,
    createdAt: Date.now()
  });

  // Start processing asynchronously (in-process worker)
  process.nextTick(() => runConversionJob(id, { format, codec, sampleRate, bitrate, bitDepth, channels, compression, normalize, metadataEdits, artworkPath: fields._artworkPath }));

  return { id, statusUrl: `/api/status/${id}`, downloadUrl: `/api/download/${id}`, metadata };
});

server.get('/api/status/:id', async (req, reply) => {
  const id = req.params.id;
  const job = jobs.get(id);
  if (!job) return reply.code(404).send({ error: 'Job not found' });
  // include flag indicating whether a sidecar image was generated/copied
  return {
    id: job.id,
    status: job.status,
    progress: job.progress || 0,
    createdAt: job.createdAt,
    hasSidecar: !!job.sidecar
  };
});

server.get('/api/download/:id', async (req, reply) => {
  const id = req.params.id;
  const type = req.query.type;
  const job = jobs.get(id);
  if (!job || job.status !== 'done') return reply.code(404).send({ error: 'File not available' });

  let filePath = job.outputPath;
  let filename;

  if (type === 'sidecar') {
    if (!job.sidecar) return reply.code(404).send({ error: 'Sidecar not available' });
    filePath = job.sidecar;
    const ext = path.extname(filePath) || '';
    filename = `artwork${ext}`;
  } else {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath);
    filename = `audio-converted${ext}`;
    reply.header('Content-Length', stat.size);
  }

  const stat = fs.statSync(filePath);
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(filePath);
  // File will be auto-deleted after 5 minutes by periodic cleanup, not on close
  return reply.type('application/octet-stream').send(stream);
});

// POST /api/probe - accept multipart file and return metadata only (no conversion)
server.post('/api/probe', async (req, reply) => {
  const mp = await req.file();
  if (!mp) {
    return reply.code(400).send({ error: 'No file uploaded' });
  }

  const id = uuidv4();
  const originalExt = path.extname(mp.filename) || '';
  const inputPath = path.join(UPLOAD_DIR, `${id}-probe${originalExt}`);

  // Save uploaded file
  await saveStreamToFile(mp.file, inputPath);

  // Probe metadata using ffprobe
  let metadata = null;
  try {
    metadata = await probeFile(inputPath);
  } catch (e) {
    server.log.warn('ffprobe failed:', e && e.message ? e.message : e);
    await removeFile(inputPath);
    return reply.code(400).send({ error: 'Failed to analyze file' });
  }

  // Clean up probe temp file immediately
  await removeFile(inputPath);

  return { metadata, filename: mp.filename };
});

async function runConversionJob(id, options) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = 'processing';
  jobs.set(id, job);

  // Handle sidecar extraction/copy for formats that cannot embed images
  const fmt = (options.format || '').toString().toLowerCase();
  const needsSidecar = ['wav', 'aiff'].includes(fmt);
  if (needsSidecar) {
    // If user provided artwork, copy it as sidecar next to output
    const sidecarExt = options.artworkPath ? path.extname(options.artworkPath) || '.jpg' : '.jpg';
    const sidecarPath = `${job.outputPath}${sidecarExt}`;
    try {
      if (options.artworkPath) {
        // copy provided artwork
        await fs.promises.copyFile(options.artworkPath, sidecarPath);
        job.sidecar = sidecarPath;
      } else if (job.metadata && Array.isArray(job.metadata.streams)) {
        // detect attached picture stream in original and extract it
        const vstream = job.metadata.streams.find(s => s.codec_type === 'video' || (s.disposition && s.disposition.attached_pic));
        if (vstream) {
          // choose extraction codec: if mjpeg -> jpg, else png
          const preferExt = (vstream.codec_name && vstream.codec_name.includes('mjpeg')) ? '.jpg' : '.png';
          const extractPath = `${job.outputPath}${preferExt}`;
          // run ffmpeg to extract image
          await new Promise((resolve, reject) => {
            const extractArgs = ['-y', '-i', job.inputPath, '-map', '0:v:0', '-c:v', (preferExt === '.jpg' ? 'copy' : 'png'), extractPath];
            const ex = spawn('ffmpeg', extractArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
            let err = '';
            ex.stderr.on('data', (c) => err += c.toString());
            ex.on('close', (code) => {
              if (code === 0) return resolve();
              return reject(new Error(`ffmpeg extract exited ${code}: ${err.slice(0,1000)}`));
            });
            ex.on('error', (e) => reject(e));
          });
          job.sidecar = extractPath;
        }
      }
    } catch (e) {
      server.log.warn({ err: e && e.message ? e.message : e }, 'failed to extract/copy sidecar artwork');
    }
  }

  const ffArgs = buildFfmpegArgs(job.inputPath, job.outputPath, options);

  // Spawn ffmpeg safely without shell
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

  // Collect stderr for debugging and progress estimation
  let ffStderr = '';
  ff.stderr.on('data', (chunk) => {
    const txt = chunk.toString();
    ffStderr += txt;
    // Could parse duration/time to estimate progress; keep simple
    job.progress = Math.min(95, (job.progress || 0) + 5);
    jobs.set(id, job);
  });

  ff.on('error', (err) => {
    job.status = 'error';
    job.error = err.message;
    server.log.error({ err: err.message, id }, 'ffmpeg error event');
    jobs.set(id, job);
  });

  ff.on('close', (code) => {
    if (code === 0) {
      job.status = 'done';
      job.progress = 100;
    } else {
      job.status = 'error';
      // include a snippet of stderr to help diagnose
      const snippet = ffStderr ? ffStderr.slice(-2000) : '';
      job.error = `ffmpeg exited with code ${code}: ${snippet}`;
      server.log.error({ code, id, stderrSnippet: snippet }, 'ffmpeg exited non-zero');
    }
    jobs.set(id, job);
  });
}

// Periodic cleanup: remove files older than 5 minutes
setInterval(() => {
  cleanupOldFiles(UPLOAD_DIR, 1000 * 60 * 5);
  cleanupOldFiles(OUTPUT_DIR, 1000 * 60 * 5);
}, 1000 * 60 * 1); // Check every minute

// Start server
async function start() {
  try {
    // default backend listens on 3001 now (frontend runs on 3000)
    const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
    await server.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
