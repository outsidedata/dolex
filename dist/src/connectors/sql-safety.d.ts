/**
 * SQL safety pass — advisory footgun detection for model/human-authored SELECTs.
 *
 * The engine NEVER rewrites the caller's SQL (that would be "hidden SQL" — the
 * analyst must stay in control). Instead it DETECTS silent-wrong-answer traps and
 * SIGNALS them back as warnings, so the caller re-issues a corrected query. This
 * mirrors the evaluator-gate principle at the query layer.
 *
 * Design validated head-to-head in
 * `local-orchestration/experiments/017-sql-integer-division.ts`: an auto-rewrite
 * variant corrupted `/` inside string literals and comments; a type-blind detector
 * cried wolf on legitimate real-typed division. The promoted approach is
 * term-aware + TYPE-aware detection with no mutation.
 *
 * Currently detects: integer-division truncation (`int / int` → SQLite floors to 0).
 * Add further checks (div-by-zero, bare GROUP BY, COUNT DISTINCT nulls, anti-join
 * NULL trap) here as new functions invoked by detectSqlFootguns.
 */
export interface SqlSafetyWarning {
    code: 'integer-division' | 'division-by-zero' | 'bare-aggregate';
    message: string;
}
/** Resolve a base column's SQLite storage type ('integer' | 'real' | ...), or
 *  undefined when the operand is not a resolvable base column (alias/expr). */
export type ColumnTypeResolver = (column: string) => Promise<string | undefined>;
/** Multiplicative terms containing a `/` that are NOT already float-safe (no float
 *  literal, no CAST-to-real), with their candidate column identifiers. Pure syntax
 *  — cheap enough to use as a pre-filter before any type probing. */
export declare function riskyDivisionTerms(sql: string): {
    term: string;
    columns: string[];
}[];
/** Division denominators (the operand right of each `/`) with their candidate
 *  column identifiers. A `NULLIF(...)`-wrapped denominator is already guarded and
 *  skipped. Applies to ALL division (float `x/0` also yields NULL in SQLite), so
 *  it is independent of the integer-truncation check above. */
export declare function divisionDenominators(sql: string): {
    denom: string;
    columns: string[];
}[];
/**
 * Detect division whose denominator column actually CONTAINS a zero — `x / 0`
 * silently yields NULL in SQLite (no error), which then vanishes from downstream
 * aggregates. Data-gated on purpose: it warns ONLY when a real zero is present, so
 * it never cries wolf on a zero-free denominator (no overbearing blanket warning).
 */
export declare function detectDivByZero(sql: string, columnHasZero: (column: string) => Promise<boolean>): Promise<SqlSafetyWarning[]>;
/**
 * Detect a bare (non-aggregated, non-grouped) column selected ALONGSIDE an
 * aggregate with NO GROUP BY — e.g. `SELECT name, SUM(score) FROM t`. SQLite does
 * not error; it pairs an ARBITRARY row's `name` with a whole-table aggregate (a
 * meaningless pairing the caller rarely intends).
 *
 * Deliberately CONSERVATIVE — built to avoid false positives:
 *  - skips anything with a GROUP BY (verifying GROUP BY membership syntactically is
 *    too false-positive-prone);
 *  - skips a LONE MIN()/MAX(): SQLite has a documented special case where bare
 *    columns then take values from the extremal row, so that is actually correct;
 *  - only flags identifiers that are real base columns.
 */
export declare function detectBareAggregate(sql: string, isBaseColumn: (col: string) => boolean): SqlSafetyWarning[];
/**
 * Detect silent-wrong-answer footguns in a SELECT. Type-aware: a division term is
 * flagged only when EVERY resolvable operand column is integer-typed (a single
 * real operand means SQLite promotes to real → no truncation). Unknown operands
 * are treated conservatively as non-integer (no flag) to avoid crying wolf.
 */
export declare function detectSqlFootguns(sql: string, columnType: ColumnTypeResolver): Promise<SqlSafetyWarning[]>;
