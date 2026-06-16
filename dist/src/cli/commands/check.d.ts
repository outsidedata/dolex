/**
 * `dolex check` — audit a dataset for bad data and analysis footguns before you
 * trust it. Read-only. Surfaces type traps, missing-value sentinels, dead/leaked
 * columns, duplicate rows, outliers, and quoting footguns, ranked by severity.
 *
 * Exits non-zero when HIGH-severity issues are found, so scripts/agents can gate.
 */
export declare function checkCommand(argv: string[]): Promise<number>;
