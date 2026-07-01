/**
 * `dolex sources` — manage the persistent data-source registry at
 * `~/.dolex/sources.json` (CSV / Postgres / MongoDB; shared with the MCP server's `load_source`).
 */
export declare function sourcesCommand(argv: string[]): Promise<number>;
