/**
 * `dolex query` — run read-only SQL against a CSV / source and print rows.
 * Formats: table (default), json, ndjson, csv.
 */
export declare function queryCommand(argv: string[]): Promise<number>;
