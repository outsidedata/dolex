/**
 * Resolve the installed package's root directory at runtime, regardless of
 * whether the calling module runs from `src/` (dev, via tsx) or `dist/src/`
 * (the published build).
 *
 * Why this exists: a fixed relative climb like `../../../../data/geo` lands at
 * the repo root when running from `src/` but at `dist/` when running from the
 * compiled `dist/src/` — so files shipped at the package root (data/geo,
 * assets) can't be found in the published package. That is a classic
 * "works in dev, broken once published" bug. Walking up to the package's own
 * `package.json` resolves correctly in every layout.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const PKG_NAMES = new Set(['@outsidedata/dolex', 'dolex']);
/**
 * Walk up from a module URL (`import.meta.url`) to the nearest `package.json`
 * whose name is this package, and return that directory. Falls back to the
 * nearest ancestor containing any `package.json`, then to the starting dir.
 */
export function findPackageRoot(fromUrl) {
    const startDir = dirname(fileURLToPath(fromUrl));
    let dir = startDir;
    let firstWithPkg;
    for (let i = 0; i < 12; i++) {
        const pkg = join(dir, 'package.json');
        if (existsSync(pkg)) {
            if (firstWithPkg === undefined)
                firstWithPkg = dir;
            try {
                const name = JSON.parse(readFileSync(pkg, 'utf-8')).name;
                if (PKG_NAMES.has(name))
                    return dir;
            }
            catch {
                /* unreadable package.json — keep walking */
            }
        }
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return firstWithPkg ?? startDir;
}
/** Resolve a path relative to the package root, e.g. `packagePath(url, 'data/geo')`. */
export function packagePath(fromUrl, ...segments) {
    return join(findPackageRoot(fromUrl), ...segments);
}
