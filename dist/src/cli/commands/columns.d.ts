/**
 * `dolex columns` (alias `transforms`) — list a table's columns by layer:
 * source (from the CSV), derived (persisted expressions), working (session-only,
 * normally empty for the stateless CLI).
 */
export declare function columnsCommand(argv: string[]): Promise<number>;
