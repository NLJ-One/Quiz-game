import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const photosDir = path.join(rootDir, 'web', 'assets', 'photos');
const manifestPath = path.join(rootDir, 'web', 'data', 'photos.json');
const supportedImage = /\.(avif|gif|jpe?g|png|webp)$/i;

const photos = (await fs.readdir(photosDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && supportedImage.test(entry.name))
  .map((entry) => `/assets/photos/${entry.name}`)
  .sort((a, b) => a.localeCompare(b, 'fr'));

await fs.writeFile(manifestPath, `${JSON.stringify(photos, null, 2)}\n`, 'utf8');
console.log(`${photos.length} photo(s) indexée(s) dans web/data/photos.json.`);
