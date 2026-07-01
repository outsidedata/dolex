import { describe, it, expect } from 'vitest';
import { auditColumns, type QualityFinding } from '../../src/analysis/quality.js';
import type { DataColumn } from '../../src/types.js';

function col(partial: Partial<DataColumn> & { name: string }): DataColumn {
  return {
    type: 'categorical',
    sampleValues: [],
    uniqueCount: 0,
    nullCount: 0,
    totalCount: 100,
    ...partial,
  } as DataColumn;
}

function issues(findings: QualityFinding[]): string[] {
  return findings.map((f) => f.issue);
}
function find(findings: QualityFinding[], issue: string): QualityFinding | undefined {
  return findings.find((f) => f.issue === issue);
}

describe('auditColumns data-quality heuristics', () => {
  it('flags an all-null column as high severity', () => {
    const f = auditColumns('t', [col({ name: 'x', type: 'numeric', nullCount: 100, totalCount: 100 })], 100);
    expect(find(f, 'all-null')?.severity).toBe('high');
  });

  it('flags a mostly-null column as medium', () => {
    const f = auditColumns('t', [col({ name: 'x', type: 'numeric', nullCount: 60, totalCount: 100, uniqueCount: 5 })], 100);
    expect(find(f, 'mostly-null')?.severity).toBe('medium');
  });

  it('flags a mixed numeric/text column as high (lexicographic risk)', () => {
    const f = auditColumns('t', [
      col({ name: 'amount', type: 'categorical', sampleValues: ['10', '20', 'N/A', '30', '40'], uniqueCount: 5 }),
    ], 100);
    const mixed = find(f, 'mixed-type');
    expect(mixed?.severity).toBe('high');
  });

  it('notes all-numeric text with leading zeros (low severity, not a code witch-hunt)', () => {
    const f = auditColumns('t', [
      col({ name: 'zip', type: 'categorical', sampleValues: ['00501', '00502', '00503'], uniqueCount: 50 }),
    ], 100);
    expect(find(f, 'numeric-text')?.severity).toBe('low');
  });

  it('does NOT flag zero-padded values on date-part columns (month/hour)', () => {
    const f = auditColumns('t', [
      col({ name: 'month', type: 'categorical', sampleValues: ['01', '02', '03', '12'], uniqueCount: 12 }),
    ], 100);
    expect(find(f, 'numeric-text')).toBeUndefined();
  });

  it('flags a genuinely constant column', () => {
    const f = auditColumns('t', [
      col({ name: 'flag', type: 'categorical', uniqueCount: 1, topValues: [{ value: 'Y', count: 100 }] }),
    ], 100);
    expect(find(f, 'constant')?.severity).toBe('medium');
  });

  it('does NOT call a sparse flag (mostly blank + a few Y) a constant', () => {
    // 175 blanks + 2 'Y' → one distinct non-empty value, but the blank-vs-Y is signal.
    const f = auditColumns('t', [
      col({ name: 'tie', type: 'categorical', uniqueCount: 1, totalCount: 177, topValues: [{ value: 'Y', count: 2 }] }),
    ], 177);
    expect(find(f, 'constant')).toBeUndefined();
  });

  it('flags a non-ISO date column as a time-series footgun', () => {
    const f = auditColumns('t', [
      col({ name: 'schedule_date', type: 'date', uniqueCount: 200, sampleValues: ['9/2/1966', '12/25/1970', '1/1/2000'] }),
    ], 200);
    expect(find(f, 'non-iso-date')?.severity).toBe('medium');
  });

  it('does NOT flag an ISO date column as non-iso', () => {
    const f = auditColumns('t', [
      col({ name: 'order_date', type: 'date', uniqueCount: 200, sampleValues: ['1872-11-30', '2024-01-15'] }),
    ], 200);
    expect(find(f, 'non-iso-date')).toBeUndefined();
  });

  it('flags an unambiguous missing-value sentinel among categories', () => {
    const f = auditColumns('t', [
      col({ name: 'cat', type: 'categorical', uniqueCount: 3, topValues: [{ value: 'a', count: 50 }, { value: 'N/A', count: 10 }] }),
    ], 100);
    expect(find(f, 'sentinel-value')?.severity).toBe('medium');
  });

  it('does NOT flag ambiguous tokens like "na" (Namibia) or "none" as sentinels', () => {
    const f = auditColumns('t', [
      col({ name: 'country', type: 'categorical', uniqueCount: 3, topValues: [{ value: 'us', count: 40 }, { value: 'na', count: 30 }, { value: 'uk', count: 30 }] }),
    ], 100);
    expect(find(f, 'sentinel-value')).toBeUndefined();
  });

  it('flags numeric outliers beyond 3×IQR (advisory)', () => {
    const f = auditColumns('t', [
      col({ name: 'val', type: 'numeric', uniqueCount: 50, stats: { min: 0, max: 1000, mean: 5, median: 4, stddev: 50, p25: 3, p75: 6 } }),
    ], 100);
    expect(find(f, 'outliers')?.severity).toBe('low');
  });

  it('flags a zero minimum on a measurement-like column', () => {
    const f = auditColumns('t', [
      col({ name: 'price', type: 'numeric', uniqueCount: 50, stats: { min: 0, max: 100, mean: 50, median: 50, stddev: 10, p25: 40, p75: 60 } }),
    ], 100);
    expect(find(f, 'suspicious-zero')).toBeDefined();
  });

  it('flags an id-like categorical (near-unique)', () => {
    const f = auditColumns('t', [col({ name: 'code', type: 'text', uniqueCount: 99, nullCount: 0, totalCount: 100 })], 100);
    expect(find(f, 'id-like')?.severity).toBe('low');
  });

  it('flags a column name needing quoting (footgun)', () => {
    const f = auditColumns('t', [col({ name: 'World Wide Sales (in $)', type: 'numeric', uniqueCount: 50 })], 100);
    expect(find(f, 'special-char-name')).toBeDefined();
  });

  it('notes a year column', () => {
    const f = auditColumns('t', [
      col({ name: 'year', type: 'date', sampleValues: ['2019', '2020', '2021'], uniqueCount: 3 }),
    ], 100);
    expect(find(f, 'year-column')).toBeDefined();
  });

  it('reports nothing for a clean, well-typed column', () => {
    const f = auditColumns('t', [
      col({ name: 'region', type: 'categorical', sampleValues: ['North', 'South', 'East', 'West'], uniqueCount: 4, nullCount: 0 }),
    ], 100);
    expect(issues(f)).toEqual([]);
  });

  it('flags accounting-style negatives "(1,234)" as numeric-text-parens', () => {
    const f = auditColumns('t', [
      col({ name: 'pnl', type: 'categorical', sampleValues: ['(1,234)', '(5,000)', '(2,000.50)'], uniqueCount: 50 }),
    ], 100);
    expect(find(f, 'numeric-text-parens')?.severity).toBe('high');
  });

  it('flags a boolean column with mixed encodings (Yes/Y/No) as boolean-variants', () => {
    const f = auditColumns('t', [
      col({ name: 'active', type: 'categorical', sampleValues: ['Yes', 'Y', 'No', 'N'], uniqueCount: 4 }),
    ], 100);
    expect(find(f, 'boolean-variants')).toBeDefined();
  });

  it('does NOT flag a clean Yes/No boolean (no variants to canonicalize)', () => {
    const f = auditColumns('t', [
      col({ name: 'active', type: 'categorical', sampleValues: ['Yes', 'No'], uniqueCount: 2 }),
    ], 100);
    expect(find(f, 'boolean-variants')).toBeUndefined();
  });

  it('flags leading/trailing whitespace as dirty-whitespace', () => {
    const f = auditColumns('t', [
      col({ name: 'city', type: 'categorical', sampleValues: ['Paris', 'Berlin ', 'Rome'], uniqueCount: 50 }),
    ], 100);
    expect(find(f, 'dirty-whitespace')).toBeDefined();
  });

  it('does NOT double-flag dirty-whitespace when dirty-categories already fires', () => {
    const f = auditColumns('t', [
      col({ name: 'dept', type: 'categorical', topValues: [{ value: 'Billing', count: 10 }, { value: 'billing ', count: 8 }] as any, sampleValues: ['Billing', 'billing '], uniqueCount: 2 }),
    ], 100);
    expect(find(f, 'dirty-categories')).toBeDefined();
    expect(find(f, 'dirty-whitespace')).toBeUndefined();
  });
});

// ── New rules added to reach the silent-wrong adversarial vectors ──────────────
import { auditDataset, formatAuditForPrompt, tableLevelChecks, type AuditQueryFn } from '../../src/analysis/quality.js';

const stats = (s: Partial<NonNullable<DataColumn['stats']>>): DataColumn['stats'] =>
  ({ min: 0, max: 0, mean: 0, median: 0, stddev: 0, p25: 0, p75: 0, ...s } as DataColumn['stats']);

describe('numeric sentinel detection (V1 vector)', () => {
  it('flags −999 sitting below the distribution as HIGH sentinel, not just an outlier', () => {
    const f = auditColumns('t', [
      col({ name: 'reading', type: 'numeric', uniqueCount: 17,
        stats: stats({ min: -999, max: 53, mean: -160, median: 50, p25: 48, p75: 51 }) }),
    ], 100);
    expect(find(f, 'sentinel-value')?.severity).toBe('high');
    expect(find(f, 'outliers')).toBeUndefined(); // upgraded, not double-reported
  });

  it('does NOT flag −999 when it is a legitimate in-distribution value (no false positive)', () => {
    // A column ranging −2000..−500 where −999 is normal: min===p25, not an outlier.
    const f = auditColumns('t', [
      col({ name: 'elevation', type: 'numeric', uniqueCount: 40,
        stats: stats({ min: -999, max: -500, mean: -800, median: -820, p25: -999, p75: -600 }) }),
    ], 100);
    expect(find(f, 'sentinel-value')).toBeUndefined();
  });
});

describe('string-sentinel affinity trap (numeric col, coerced-to-NULL token)', () => {
  // The CSV connector types a mostly-numeric column `numeric` and coerces a
  // recurring string sentinel (e.g. "Undrafted") to NULL — which silently voids
  // `WHERE col = 'Undrafted'` (matches zero rows). The connector reports the
  // coerced token; the auditor must surface it as a HIGH mixed-type finding.
  it('flags a numeric column carrying a recurring coerced sentinel as HIGH mixed-type', () => {
    const f = auditColumns('t', [
      col({ name: 'draft_number', type: 'numeric', uniqueCount: 60, totalCount: 12844,
        stats: stats({ min: 1, max: 165, mean: 22, median: 20, p25: 11, p75: 32 }),
        coercedNonNumeric: { token: 'Undrafted', count: 2414 } }),
    ], 12844);
    const mixed = find(f, 'mixed-type');
    expect(mixed?.severity).toBe('high');
    expect(mixed?.detail).toContain('Undrafted');
  });

  it('does NOT flag a clean numeric column with no coerced values (no false positive)', () => {
    const f = auditColumns('t', [
      col({ name: 'pts', type: 'numeric', uniqueCount: 300, totalCount: 12844,
        stats: stats({ min: 0, max: 36, mean: 8, median: 7, p25: 3, p75: 11 }) }),
    ], 12844);
    expect(find(f, 'mixed-type')).toBeUndefined();
  });

  it('does NOT flag a SINGLE stray non-numeric cell (a typo, below the sentinel threshold)', () => {
    const f = auditColumns('t', [
      col({ name: 'measurement', type: 'numeric', uniqueCount: 300, totalCount: 12844,
        stats: stats({ min: 0, max: 36, mean: 8, median: 7, p25: 3, p75: 11 }),
        coercedNonNumeric: { token: '??', count: 1 } }),
    ], 12844);
    expect(find(f, 'mixed-type')).toBeUndefined();
  });
});

describe('thousands-separator numbers stored as text (V2 vector)', () => {
  it('flags "1,200"-style text money as HIGH (SUM coerces it wrong)', () => {
    const f = auditColumns('t', [
      col({ name: 'amount', type: 'categorical', uniqueCount: 5,
        topValues: [{ value: '1,200', count: 1 }, { value: '12,500', count: 1 }, { value: '3,450', count: 1 }] }),
    ], 100);
    expect(find(f, 'numeric-text-separators')?.severity).toBe('high');
  });

  it('does NOT flag names that contain a comma (no false positive)', () => {
    const f = auditColumns('t', [
      col({ name: 'name', type: 'categorical', uniqueCount: 3,
        topValues: [{ value: 'Smith, John', count: 1 }, { value: 'Doe, Jane', count: 1 }, { value: 'Roe, Sam', count: 1 }] }),
    ], 100);
    expect(find(f, 'numeric-text-separators')).toBeUndefined();
  });
});

describe('dirty categories — case/whitespace split (V5 vector)', () => {
  it('flags categories that collapse under trim+lower', () => {
    const f = auditColumns('t', [
      col({ name: 'category', type: 'categorical', uniqueCount: 4,
        topValues: [
          { value: 'Billing', count: 22 }, { value: 'Technical', count: 30 },
          { value: 'billing', count: 10 }, { value: 'Billing ', count: 9 },
        ] }),
    ], 100);
    expect(find(f, 'dirty-categories')?.severity).toBe('medium');
  });

  it('does NOT flag genuinely distinct categories (no false positive)', () => {
    const f = auditColumns('t', [
      col({ name: 'category', type: 'categorical', uniqueCount: 3,
        topValues: [{ value: 'Billing', count: 22 }, { value: 'Technical', count: 30 }, { value: 'Sales', count: 9 }] }),
    ], 100);
    expect(find(f, 'dirty-categories')).toBeUndefined();
  });

  // Free-text guard — calibrated on the real-data red-team. The discriminator is
  // VALUE LENGTH (free-text prose), NOT cardinality: ecommerce review_comment_message
  // (avg ~62 chars) is a false positive to suppress, but nba COMMENT (5348 distinct,
  // avg ~22 chars) is a TRUE positive to keep.
  it('does NOT flag a LONG-VALUE free-text column (review prose) even when two values collide', () => {
    const longA = 'This product exceeded my expectations and arrived quickly, would buy again';
    const f = auditColumns('t', [
      col({ name: 'review', type: 'categorical', uniqueCount: 36000, totalCount: 99224, nullCount: 0,
        sampleValues: [longA, longA.toUpperCase(), 'Recebi bem antes do prazo estipulado, recomendo a loja'],
        topValues: [{ value: 'bom', count: 50 }, { value: 'ok', count: 40 }] }),
    ], 99224);
    expect(find(f, 'dirty-categories')).toBeUndefined(); // sample avg length > 45
  });

  it('STILL flags a HIGH-CARDINALITY but SHORT-value category (nba COMMENT case)', () => {
    // 5348 distinct reason codes, avg ~22 chars, with a case/pad split — a TRUE positive.
    const f = auditColumns('t', [
      col({ name: 'COMMENT', type: 'categorical', uniqueCount: 5348, totalCount: 668628, nullCount: 0,
        sampleValues: ["DNP - Coach's Decision", "DNP - Coach's Decision ", 'NWT - Sprained Right Ankle', 'DND - Injury/Illness'],
        topValues: [{ value: "DNP - Coach's Decision", count: 58054 }, { value: "DNP - Coach's Decision ", count: 30547 }] }),
    ], 668628);
    expect(find(f, 'dirty-categories')?.severity).toBe('medium'); // short values → real category, kept
  });

  it('STILL flags a real bounded category (body: 87 distinct, short values) with a case split', () => {
    const f = auditColumns('t', [
      col({ name: 'body', type: 'categorical', uniqueCount: 87, totalCount: 558837, nullCount: 0,
        sampleValues: ['Sedan', 'SUV', 'sedan', 'Convertible'],
        topValues: [{ value: 'Sedan', count: 200000 }, { value: 'SUV', count: 150000 }, { value: 'sedan', count: 100 }] }),
    ], 558837);
    expect(find(f, 'dirty-categories')?.severity).toBe('medium');
  });
});

describe('tableLevelChecks + auditDataset + formatAuditForPrompt', () => {
  const dupQuery: AuditQueryFn = async (sql) => {
    if (sql.includes('dups')) return { ok: true, rows: [{ dups: 12 }] };
    return { ok: true, rows: [{ diff: 5 }] }; // columns differ → no identical-column finding
  };

  it('detects duplicate rows via the injected query (V4 vector)', async () => {
    const findings = await tableLevelChecks(
      { name: 't', columns: [col({ name: 'user_id', type: 'id', uniqueCount: 30 })], rowCount: 42 }, dupQuery);
    expect(find(findings, 'duplicate-rows')?.severity).toBe('medium');
  });

  it('a FAILED query is reported loudly, never silently clean', async () => {
    const failQuery: AuditQueryFn = async () => ({ ok: false, error: 'boom' });
    const findings = await tableLevelChecks(
      { name: 't', columns: [], rowCount: 10 }, failQuery);
    expect(find(findings, 'check-incomplete')?.severity).toBe('high');
  });

  it('auditDataset composes column + table checks; formatAuditForPrompt drops LOW and ranks HIGH first', async () => {
    const tables = [{
      name: 't', rowCount: 100,
      columns: [
        col({ name: 'amount', type: 'categorical', uniqueCount: 3,
          topValues: [{ value: '1,200', count: 1 }, { value: '12,500', count: 1 }] }),
        col({ name: 'zip', type: 'categorical', sampleValues: ['00501', '00502', '00503'], uniqueCount: 50 }), // LOW
      ],
    }];
    const findings = await auditDataset(tables, dupQuery);
    const note = formatAuditForPrompt(findings);
    expect(note).toContain('[HIGH]');
    expect(note).toContain('amount');
    expect(note).not.toContain('[LOW]');   // LOW noise dropped
    expect(note).not.toContain('leading zeros'); // the LOW zip finding excluded
    // HIGH ranked before MEDIUM (duplicate-rows is medium)
    expect(note.indexOf('[HIGH]')).toBeLessThan(note.indexOf('[MEDIUM]'));
  });

  it('formatAuditForPrompt returns empty string for clean data', () => {
    expect(formatAuditForPrompt([])).toBe('');
  });

  // Prompt-injection discipline (real-data regression: f1's 21 mostly-null + 12
  // non-iso findings distracted the model off a correct answer; the sentinel advice
  // made it over-exclude a row from a total COUNT). Keep the prompt action-guiding.
  it('formatAuditForPrompt DROPS advisory issues (mostly-null, non-iso-date) even at MEDIUM', () => {
    const findings: QualityFinding[] = [
      { severity: 'medium', table: 't', column: 'a', issue: 'mostly-null', detail: '60% null' },
      { severity: 'medium', table: 't', column: 'b', issue: 'non-iso-date', detail: 'looks like dates' },
      { severity: 'high', table: 't', column: 'c', issue: 'numeric-text-symbol', detail: 'currency text' },
    ];
    const note = formatAuditForPrompt(findings);
    expect(note).toContain('currency text');        // the prompt-worthy HIGH finding
    expect(note).not.toContain('60% null');         // advisory mostly-null dropped
    expect(note).not.toContain('looks like dates');  // advisory non-iso-date dropped
  });

  it('formatAuditForPrompt COLLAPSES many same-issue findings into ONE line', () => {
    const findings: QualityFinding[] = Array.from({ length: 13 }, (_, i) => ({
      severity: 'medium' as const, table: 't', column: `col${i}`, issue: 'sentinel-value',
      detail: 'contains NULL sentinel', suggestion: 'treat as null',
    }));
    const note = formatAuditForPrompt(findings);
    expect(note.split('\n').length).toBe(1);          // 13 findings → 1 line
    expect(note).toContain('13 columns with sentinel-value');
  });

  it('scoped numeric-sentinel advice tells the model NOT to drop the row from counts', () => {
    const f = auditColumns('t', [
      col({ name: 'u', type: 'numeric', uniqueCount: 90,
        stats: { min: -9999, max: 32, mean: 20, median: 22, stddev: 3, p25: 20, p75: 24 } as any }),
    ], 100);
    const note = formatAuditForPrompt(f);
    expect(note).toContain('do NOT drop it from total row COUNT');
  });

  // Code-review regression: SQL suggestion fragments must QUOTE the column
  // identifier, or a column like "Sale Price" yields broken SQL the model copies.
  it('quotes spaced column names in the numeric-text fix suggestion', () => {
    const f = auditColumns('t', [
      col({ name: 'Sale Price', type: 'categorical', uniqueCount: 3,
        sampleValues: ['$1,200', '$980', '$12,500'],
        topValues: [{ value: '$1,200', count: 1 }, { value: '$980', count: 1 }, { value: '$12,500', count: 1 }] }),
    ], 100);
    const note = formatAuditForPrompt(f);
    expect(note).toContain('"Sale Price"');        // identifier quoted
    expect(note).not.toMatch(/REPLACE\(Sale Price/); // never the bare, broken form
  });

  it('quotes spaced column names in the sentinel and dirty-categories suggestions', () => {
    const sent = formatAuditForPrompt(auditColumns('t', [
      col({ name: 'Reading mV', type: 'numeric', uniqueCount: 90,
        stats: { min: -9999, max: 32, mean: 20, median: 22, stddev: 3, p25: 20, p75: 24 } as any }),
    ], 100));
    expect(sent).toContain('WHERE "Reading mV" <>');

    const dirty = formatAuditForPrompt(auditColumns('t', [
      col({ name: 'Status Code', type: 'categorical', uniqueCount: 2,
        sampleValues: ['Active', 'active'],
        topValues: [{ value: 'Active', count: 10 }, { value: 'active', count: 7 }] }),
    ], 100));
    expect(dirty).toContain('TRIM(LOWER("Status Code"))');
  });

  // Code-review regression: collapsing a column-less issue (duplicate-rows on
  // several tables) must not say "N columns (…)" with an empty list.
  it('collapses column-less findings with a correct noun, not "N columns ()"', () => {
    const findings: QualityFinding[] = [
      { severity: 'medium', table: 'a', issue: 'duplicate-rows', detail: '5 dup rows' },
      { severity: 'medium', table: 'b', issue: 'duplicate-rows', detail: '3 dup rows' },
      { severity: 'medium', table: 'c', issue: 'duplicate-rows', detail: '1 dup row' },
    ];
    const note = formatAuditForPrompt(findings);
    expect(note).toContain('3 duplicate-rows findings');
    expect(note).not.toContain('columns with duplicate-rows ()');
  });
});

// ── Hardening from the auditor red-team (currency/percent evasion, repunit
//    sentinels, both-ends, the false-positive BUG, and the whitespace test gap) ──
describe('numeric-text: currency & percent symbols (red-team evasions)', () => {
  it('flags currency-prefixed money "$1,200" as HIGH (evaded the comma-only regex before)', () => {
    const f = auditColumns('t', [
      col({ name: 'amount', type: 'categorical', uniqueCount: 5,
        topValues: [{ value: '$1,200', count: 1 }, { value: '$12,500', count: 1 }, { value: '$980', count: 1 }] }),
    ], 100);
    const hit = find(f, 'numeric-text-symbol');
    expect(hit?.severity).toBe('high');
    expect(hit?.suggestion).toContain("'$'"); // advice strips the currency symbol
  });

  it('flags text percentages "45%" as HIGH', () => {
    const f = auditColumns('t', [
      col({ name: 'rate', type: 'categorical', uniqueCount: 5,
        topValues: [{ value: '45%', count: 1 }, { value: '30%', count: 1 }, { value: '12%', count: 1 }] }),
    ], 100);
    expect(find(f, 'numeric-text-symbol')?.severity).toBe('high');
  });

  it('does NOT flag plain text or names with a comma as numeric-text', () => {
    const f = auditColumns('t', [
      col({ name: 'name', type: 'categorical', uniqueCount: 3,
        topValues: [{ value: 'Smith, John', count: 1 }, { value: 'Doe, Jane', count: 1 }] }),
    ], 100);
    expect(find(f, 'numeric-text-symbol')).toBeUndefined();
    expect(find(f, 'numeric-text-separators')).toBeUndefined();
  });

  it('pins the V2 separator threshold: 50% comma-numbers is NOT enough (needs ≥60%)', () => {
    const f = auditColumns('t', [
      col({ name: 'mixed', type: 'categorical', uniqueCount: 4,
        topValues: [{ value: '1,200', count: 1 }, { value: '3,450', count: 1 }, { value: 'apple', count: 1 }, { value: 'banana', count: 1 }] }),
    ], 100);
    expect(find(f, 'numeric-text-separators')).toBeUndefined(); // 2/4 = 0.5 < 0.6
  });
});

describe('numeric sentinel: repunit generalization + far-outlier gate (BUG A/B fixes)', () => {
  it('flags 9999999 (7 nines, outside the fixed set) as a HIGH sentinel via repunit pattern', () => {
    const f = auditColumns('t', [
      col({ name: 'reading', type: 'numeric', uniqueCount: 7,
        stats: stats({ min: 48, max: 9999999, mean: 2000040, median: 50, p25: 49.75, p75: 53 }) }),
    ], 100);
    expect(find(f, 'sentinel-value')?.severity).toBe('high');
  });

  it('does NOT flag a real top value 99999 inside the 3×IQR fence (BUG A: gate was a no-op)', () => {
    const f = auditColumns('t', [
      col({ name: 'salary', type: 'numeric', uniqueCount: 50,
        stats: stats({ min: 20000, max: 99999, mean: 60000, median: 58000, p25: 40000, p75: 80000 }) }),
    ], 100);
    expect(find(f, 'sentinel-value')).toBeUndefined(); // 99999 < p75 + 3·IQR (=200000)
  });

  it('reports BOTH ends when a column is poisoned at min and max (BUG B)', () => {
    const f = auditColumns('t', [
      col({ name: 'v', type: 'numeric', uniqueCount: 20,
        stats: stats({ min: -999, max: 9999, mean: 30, median: 25, p25: 5, p75: 50 }) }),
    ], 100);
    const sentinels = f.filter((x) => x.issue === 'sentinel-value');
    expect(sentinels.length).toBe(2);
  });
});

describe('dirty-categories: whitespace-only split (closes the meta-test GAP)', () => {
  it('flags a category split ONLY by trailing whitespace (no case difference)', () => {
    // No case variant here — only "Billing" vs "Billing " — so dropping .trim()
    // from the key would make this test fail (the mutation that survived before).
    const f = auditColumns('t', [
      col({ name: 'category', type: 'categorical', uniqueCount: 3,
        topValues: [{ value: 'Billing', count: 22 }, { value: 'Technical', count: 30 }, { value: 'Billing ', count: 9 }] }),
    ], 100);
    expect(find(f, 'dirty-categories')?.severity).toBe('medium');
  });
});
