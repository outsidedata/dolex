/**
 * `dolex refine` — tweak a previously-produced chart.
 *
 * Takes the spec's HASH (printed by visualize/refine) as an explicit argument,
 * loads it from `~/.dolex/specs/`, hydrates the in-memory store, reuses the
 * existing `handleRefine` logic, then persists the new spec under a new hash.
 *
 * The hash is the only handle — there is intentionally no shared "last" pointer,
 * which would cross streams between concurrent CLI processes (parallel agents).
 * Each refine returns a fresh hash; pass it back to chain further refinements.
 */
export declare function refineCommand(argv: string[]): Promise<number>;
/**
 * `value:desc` | `region:asc` | `desc` | `none` → refine sort shape.
 * Field names keep their original case (SQL columns are case-sensitive);
 * the direction keyword is matched case-insensitively.
 */
export declare function parseSort(raw: string): {
    field?: string;
    direction: 'asc' | 'desc';
} | null;
/**
 * Parse one or more filter clauses separated by `;`.
 * Each clause is `field op v,v` (e.g. `region in North,South`, `price gt 1000`).
 * `clear` / `none` → empty array (clears all filters).
 */
export declare function parseFilters(raw: string): {
    field: string;
    op: string;
    values: (string | number)[];
}[];
