/**
 * `dolex transform` — add a derived column to a dataset using the expression
 * language, persisted so later commands (and the MCP server) can use it.
 *
 * The MCP server splits this into transform_data (creates a session-only
 * "working" column) + promote_columns (commits it to the persisted "derived"
 * layer). A CLI process is stateless, so a working column would vanish on exit;
 * `transform` therefore creates AND persists in one step by default. Use
 * `--dry-run` to compute and preview the column's stats without persisting.
 */
export declare function transformCommand(argv: string[]): Promise<number>;
