/**
 * `dolex drop` — remove derived (or working) columns. Validates dependencies
 * and updates the persisted manifest.
 */
export declare function dropCommand(argv: string[]): Promise<number>;
