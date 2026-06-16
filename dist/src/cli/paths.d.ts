/**
 * Resolves the Dolex state directory (specs, charts, source registry).
 *
 * Defaults to `~/.dolex`. Set `DOLEX_HOME` to relocate it — useful for tests,
 * CI, sandboxes, or isolating concurrent runs.
 */
export declare function dolexHome(): string;
