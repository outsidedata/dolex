import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEO_DATA_DIR = resolve(__dirname, '../../../../data/geo');

export function loadTopojson(topoPath: string): any {
  const filePath = resolve(GEO_DATA_DIR, topoPath);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function getGeoDataDir(): string {
  return GEO_DATA_DIR;
}
