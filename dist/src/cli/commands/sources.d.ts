/**
 * `dolex sources` — manage the persistent CSV registry at
 * `~/.dolex/sources.json` (shared with the MCP server's `load_csv`).
 */
export declare function sourcesCommand(argv: string[]): Promise<number>;
