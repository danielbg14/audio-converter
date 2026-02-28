import { spawn } from 'child_process';
import { formatConfig, SUPPORTED_FORMATS } from '../config/formats.js';

/**
 * Build FFmpeg arguments safely with comprehensive format support
 * @param {string} inputPath - Path to input file
 * @param {string} outputPath - Path to output file
 * @param {object} options - Conversion options
 * @returns {array} FFmpeg arguments array
 */
export function buildFfmpegArgs(inputPath, outputPath, options = {}) {
  const args = ['-y', '-i', inputPath];
  let extraInputCount = 1; // number of input files (inputPath is index 0)
  // If an artwork file path is provided, add it as an extra input immediately
  // so that subsequent options (which are output options) are not mistakenly
  // applied to the artwork input.
  if (options.artworkPath) {
    args.push('-i', options.artworkPath);
    extraInputCount++;
  }

  // Validate format
  const fmt = (options.format || 'mp3').toLowerCase();
  if (!SUPPORTED_FORMATS.includes(fmt)) {
    throw new Error(`Unsupported format: ${fmt}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
  }

  const config = formatConfig[fmt];
  if (!config) {
    throw new Error(`No configuration for format: ${fmt}`);
  }

  // Set codec
  const codec = options.codec || config.codec;
  if (codec) {
    args.push('-acodec', codec);
  }

  // Handle lossy formats (bitrate)
  if (config.type === 'lossy' && options.bitrate) {
    const br = String(options.bitrate).toLowerCase();
    const bitrate = br.endsWith('k') ? br : `${br}k`;
    args.push('-b:a', bitrate);
  }

  // Handle lossless formats (bit depth)
  if (config.type === 'lossless' && options.bitDepth) {
    const depth = Number(options.bitDepth);
    if ([16, 24, 32].includes(depth)) {
      // For PCM formats, prefer explicit PCM codec selection when possible.
      // Guard codec usage since codec may be null.
      if (codec && String(codec).includes('pcm')) {
        // If codec already requests PCM, attempt to set sample format via sample_fmt
        // Map common depths to sample_fmt values
        const sampleFmt = depth === 16 ? 's16' : depth === 24 ? 's32' : 's32';
        args.push('-sample_fmt', sampleFmt);
      } else if (fmt === 'wav' || fmt === 'aiff') {
        // For WAV/AIFF, explicitly select a PCM encoder matching depth
        let pcmCodec = 'pcm_s16le';
        if (depth === 24) pcmCodec = 'pcm_s24le';
        if (depth === 32) pcmCodec = 'pcm_s32le';
        args.push('-acodec', pcmCodec);
      }
    }
  }

  // Sample rate
  if (options.sampleRate) {
    const sr = Number(options.sampleRate);
    if (sr > 0) {
      args.push('-ar', String(sr));
    }
  }

  // Channels
  if (options.channels) {
    const ch = Number(options.channels);
    if ([1, 2].includes(ch)) {
      args.push('-ac', String(ch));
    }
  }

  // FLAC compression level
  if (fmt === 'flac' && options.compression !== undefined) {
    const comp = Number(options.compression);
    if (comp >= 0 && comp <= 8) {
      args.push('-compression_level', String(comp));
    }
  }

  // Normalize audio (optional, uses loudnorm filter)
  if (options.normalize === true || String(options.normalize) === 'true') {
    args.push('-af', 'loudnorm=I=-16:LRA=7:TP=-1.5');
  }

  // Compute metadata handling (store for later)
  const hasMetadataEdits = options.metadataEdits && typeof options.metadataEdits === 'object';
  
  // Determine stream mapping (at the end, before output path)
  // Stream mapping must come AFTER format/codec settings but needs to be explicit to exclude video
  let mapArgs = [];
  let metadataArgs = [];

  // Build metadata arguments (applied after mapping for proper precedence)
  if (hasMetadataEdits) {
    // Clear existing metadata so we write only provided tags (allowing deletions)
    metadataArgs.push('-map_metadata', '-1');
    
    const meta = options.metadataEdits || {};
    // global tags
    if (meta.global && typeof meta.global === 'object') {
      for (const [k, v] of Object.entries(meta.global)) {
        if (v === null || v === undefined || v === '') continue;
        metadataArgs.push('-metadata', `${k}=${String(v)}`);
      }
    }

    // stream tags
    if (meta.streams && typeof meta.streams === 'object') {
      for (const [streamIdx, tags] of Object.entries(meta.streams)) {
        for (const [k, v] of Object.entries(tags || {})) {
          if (v === null || v === undefined || v === '') continue;
          metadataArgs.push(`-metadata:s:${streamIdx}`, `${k}=${String(v)}`);
        }
      }
    }
  } else if (options.preserveMetadata !== false) {
    // Preserve metadata from input by default
    metadataArgs.push('-map_metadata', '0');
  }

  // Always map audio
  mapArgs.push('-map', '0:a');

  // Formats that support embedded video/artwork streams
  const formatsWithArtworkSupport = new Set(['mp3', 'flac', 'aac', 'alac', 'wma', 'ogg', 'opus']);
  const supportsArtwork = formatsWithArtworkSupport.has(fmt);

  // Handle artwork: preserve original or replace with new (only for supporting formats)
  if (supportsArtwork) {
    if (options.artworkPath) {
      // User provided new artwork: map from input 1 (the artwork file)
      mapArgs.push('-map', '1:0');
      // For OGG/Opus we must re-encode image to a supported codec (PNG)
      if (fmt === 'ogg' || fmt === 'opus') {
        mapArgs.push('-c:v', 'png');
      } else {
        mapArgs.push('-c:v', 'copy');
      }
      mapArgs.push('-disposition:v', 'attached_pic');
    } else {
      // No new artwork: preserve original from input 0 if it exists
      // Use 0:v? to optionally map video (attached art) if present
      mapArgs.push('-map', '0:v?');
      // If original artwork exists and target is OGG/Opus, re-encode to PNG
      if (fmt === 'ogg' || fmt === 'opus') {
        mapArgs.push('-c:v', 'png');
      } else {
        mapArgs.push('-c:v', 'copy');
      }
      mapArgs.push('-disposition:v', 'attached_pic');
    }
    // Add artwork metadata tags where applicable
    metadataArgs.push('-metadata:s:v:0', 'title=Cover');
    metadataArgs.push('-metadata:s:v:0', 'comment=Cover (front)');
  }

  // Add mapping and metadata arguments before output path
  args.push(...mapArgs);
  args.push(...metadataArgs);

  // Output path
  args.push(outputPath);

  return args;
}

/**
 * Generate example FFmpeg command for documentation
 */
export function generateExampleCommand(inputPath, outputPath, options = {}) {
  const args = buildFfmpegArgs(inputPath, outputPath, options);
  return `ffmpeg ${args.join(' ')}`;
}

/**
 * Probe a file using ffprobe and return parsed JSON metadata
 */
export function probeFile(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_format',
      '-show_streams',
      '-print_format', 'json',
      filePath
    ];
    const ff = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    ff.stdout.on('data', (chunk) => out += chunk.toString());
    ff.stderr.on('data', (chunk) => err += chunk.toString());
    ff.on('error', (e) => reject(e));
    ff.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}: ${err}`));
      }
      try {
        const data = JSON.parse(out);
        resolve(data);
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Export format configuration for client-side use
 */
export function getFormatInfo() {
  return formatConfig;
}

export function getFormatConfig(format) {
  return formatConfig[format.toLowerCase()] || null;
}
