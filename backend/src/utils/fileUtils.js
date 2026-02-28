import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';

const stat = promisify(fs.stat);

export async function saveStreamToFile(stream, destPath) {
  const temp = destPath + '.tmp';
  const writeStream = fs.createWriteStream(temp);
  await pipeline(stream, writeStream);
  await fs.promises.rename(temp, destPath);
}

export async function removeFile(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (e) {
    // ignore
  }
}

export function ensureDirs(dirs) {
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

export async function cleanupOldFiles(dir, olderThanMs = 1000 * 60 * 60) {
  try {
    const files = await fs.promises.readdir(dir);
    const now = Date.now();
    for (const f of files) {
      const p = path.join(dir, f);
      try {
        const s = await stat(p);
        if (now - s.mtimeMs > olderThanMs) {
          await removeFile(p);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}
