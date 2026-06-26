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

// Strip string literals + comments before any text analysis, so a `/` inside
// quoted content or a comment is never mistaken for a division operator.
// (Mirrors the literal/comment stripping already used by isReadOnlySelect.)
function strip(sql: string): string {
  return sql
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

// A maximal multiplicative term: operand ([*/] operand)+. operand = number |
// func(one paren level) | identifier. One level covers SUM(wins), AVG(x)/COUNT(*).
const OPERAND = String.raw`(?:\w+\s*\([^()]*\)|\w+(?:\.\w+)?|\d+(?:\.\d+)?)`;
const TERM = new RegExp(`${OPERAND}(?:\\s*[*/]\\s*${OPERAND})+`, 'g');
const FLOAT_LIT = /\d+\.\d+/;
const CAST_REAL = /CAST\s*\([^()]*AS\s+(?:REAL|FLOAT|DOUBLE)/i;
const TERM_FUNCS = new Set(['sum', 'avg', 'count', 'min', 'max', 'cast', 'as', 'real', 'float', 'double', 'total', 'abs', 'round']);

/** Multiplicative terms containing a `/` that are NOT already float-safe (no float
 *  literal, no CAST-to-real), with their candidate column identifiers. Pure syntax
 *  — cheap enough to use as a pre-filter before any type probing. */
export function riskyDivisionTerms(sql: string): { term: string; columns: string[] }[] {
  const s = strip(sql);
  const out: { term: string; columns: string[] }[] = [];
  for (const m of s.matchAll(TERM)) {
    const term = m[0];
    if (!term.includes('/')) continue; // pure multiplication can't truncate
    if (FLOAT_LIT.test(term) || CAST_REAL.test(term)) continue; // float context → safe
    const columns = [...term.matchAll(/[a-z_]\w*/gi)].map((x) => x[0]).filter((id) => !TERM_FUNCS.has(id.toLowerCase()));
    out.push({ term, columns });
  }
  return out;
}

/** Division denominators (the operand right of each `/`) with their candidate
 *  column identifiers. A `NULLIF(...)`-wrapped denominator is already guarded and
 *  skipped. Applies to ALL division (float `x/0` also yields NULL in SQLite), so
 *  it is independent of the integer-truncation check above. */
export function divisionDenominators(sql: string): { denom: string; columns: string[] }[] {
  const s = strip(sql);
  const re = new RegExp(`/\\s*(${OPERAND})`, 'g');
  const out: { denom: string; columns: string[] }[] = [];
  for (const m of s.matchAll(re)) {
    const denom = m[1].trim();
    if (/^NULLIF\s*\(/i.test(denom)) continue; // already guarded
    const columns = [...denom.matchAll(/[a-z_]\w*/gi)].map((x) => x[0]).filter((id) => !TERM_FUNCS.has(id.toLowerCase()) && id.toLowerCase() !== 'nullif');
    if (columns.length) out.push({ denom, columns });
  }
  return out;
}

/**
 * Detect division whose denominator column actually CONTAINS a zero — `x / 0`
 * silently yields NULL in SQLite (no error), which then vanishes from downstream
 * aggregates. Data-gated on purpose: it warns ONLY when a real zero is present, so
 * it never cries wolf on a zero-free denominator (no overbearing blanket warning).
 */
export async function detectDivByZero(
  sql: string,
  columnHasZero: (column: string) => Promise<boolean>,
): Promise<SqlSafetyWarning[]> {
  const warnings: SqlSafetyWarning[] = [];
  for (const { denom, columns } of divisionDenominators(sql)) {
    let zero = false;
    for (const col of columns) {
      if (await columnHasZero(col)) { zero = true; break; }
    }
    if (zero) {
      warnings.push({
        code: 'division-by-zero',
        message:
          `Denominator "${denom}" contains zero values — SQLite returns NULL for x/0 (no error), and those rows silently drop out of aggregates. ` +
          `Guard it: <numerator> / NULLIF(${denom}, 0), or filter the zeros out.`,
      });
    }
  }
  return warnings;
}

const AGG = /\b(?:SUM|AVG|COUNT|MIN|MAX|TOTAL|GROUP_CONCAT|MEDIAN|STDDEV)\s*\(/i;

/** The top-level SELECT projection list (between the first SELECT and its FROM). */
function selectList(stripped: string): string | undefined {
  const m = stripped.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
  return m ? m[1] : undefined;
}

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
export function detectBareAggregate(sql: string, isBaseColumn: (col: string) => boolean): SqlSafetyWarning[] {
  const s = strip(sql);
  if (/\bGROUP\s+BY\b/i.test(s)) return []; // grouped → out of scope (conservative)
  const list = selectList(s);
  if (!list || !AGG.test(list)) return [];

  // Lone MIN()/MAX() → SQLite fills bare columns from the extremal row (correct).
  const aggs = [...list.matchAll(/\b(SUM|AVG|COUNT|MIN|MAX|TOTAL|GROUP_CONCAT|MEDIAN|STDDEV)\s*\(/gi)].map((m) => m[1].toUpperCase());
  if (aggs.length === 1 && (aggs[0] === 'MIN' || aggs[0] === 'MAX')) return [];

  // Drop aggregate call expressions, then look for surviving base-column identifiers.
  const bare = list.replace(/\b(?:SUM|AVG|COUNT|MIN|MAX|TOTAL|GROUP_CONCAT|MEDIAN|STDDEV)\s*\([^()]*\)/gi, ' ');
  const cols = [...bare.matchAll(/[a-z_]\w*/gi)].map((m) => m[0]).filter((id) => !TERM_FUNCS.has(id.toLowerCase()) && isBaseColumn(id));
  if (cols.length === 0) return [];
  const uniq = [...new Set(cols)];
  return [{
    code: 'bare-aggregate',
    message:
      `Column${uniq.length > 1 ? 's' : ''} "${uniq.join('", "')}" ${uniq.length > 1 ? 'are' : 'is'} selected next to an aggregate with no GROUP BY — ` +
      `SQLite pairs an ARBITRARY row's value with a whole-table aggregate here. ` +
      `For the label of the top row use ORDER BY … LIMIT 1 (or a subquery); for per-group rows add GROUP BY.`,
  }];
}

/**
 * Detect silent-wrong-answer footguns in a SELECT. Type-aware: a division term is
 * flagged only when EVERY resolvable operand column is integer-typed (a single
 * real operand means SQLite promotes to real → no truncation). Unknown operands
 * are treated conservatively as non-integer (no flag) to avoid crying wolf.
 */
export async function detectSqlFootguns(
  sql: string,
  columnType: ColumnTypeResolver,
): Promise<SqlSafetyWarning[]> {
  const warnings: SqlSafetyWarning[] = [];
  for (const { term, columns } of riskyDivisionTerms(sql)) {
    if (columns.length === 0) continue;
    let allInteger = true;
    for (const col of columns) {
      if ((await columnType(col)) !== 'integer') { allInteger = false; break; }
    }
    if (allInteger) {
      warnings.push({
        code: 'integer-division',
        message:
          `Integer division in "${term.trim()}" will truncate toward zero (SQLite floors int/int — e.g. 16/32 → 0, not 0.5). ` +
          `Wrap the numerator: CAST(<numerator> AS REAL) / <denominator>.`,
      });
    }
  }
  return warnings;
}
