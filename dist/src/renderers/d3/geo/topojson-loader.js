import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { packagePath } from '../../../utils/package-root.js';
// Resolve from the package ROOT (where data/geo ships), so this works both in
// dev (running src/ via tsx) and in the published package (running dist/src/).
// A fixed relative climb would land at dist/ in the build and silently fail.
const GEO_DATA_DIR = packagePath(import.meta.url, 'data', 'geo');
export function loadTopojson(topoPath) {
    const filePath = resolve(GEO_DATA_DIR, topoPath);
    if (!existsSync(filePath)) {
        throw new Error(`Map data not found: ${topoPath} (looked in ${GEO_DATA_DIR}). ` +
            `The Dolex package may be missing its data/geo maps.`);
    }
    return JSON.parse(readFileSync(filePath, 'utf8'));
}
export function getGeoDataDir() {
    return GEO_DATA_DIR;
}
