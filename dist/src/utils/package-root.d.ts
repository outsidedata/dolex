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
/**
 * Walk up from a module URL (`import.meta.url`) to the nearest `package.json`
 * whose name is this package, and return that directory. Falls back to the
 * nearest ancestor containing any `package.json`, then to the starting dir.
 */
export declare function findPackageRoot(fromUrl: string): string;
/** Resolve a path relative to the package root, e.g. `packagePath(url, 'data/geo')`. */
export declare function packagePath(fromUrl: string, ...segments: string[]): string;
