/**
 * Data-quality + footgun heuristics.
 *
 * `auditColumns` runs purely on column profiles (type, stats, top values, null
 * counts) — no data access — so it's cheap and unit-testable. The CLI's `check`
 * command layers a couple of query-based checks (duplicate rows, identical
 * columns) on top.
 *
 * The goal is confidence: surface the things that silently produce wrong or
 * misleading analysis (mixed-type columns, leaked duplicate columns, dead
 * columns, missing-value sentinels) before anyone trusts a chart.
 */

import type { DataColumn } from '../types.js';

export type QualitySeverity = 'high' | 'medium' | 'low';

export interface QualityFinding {
  severity: QualitySeverity;
  table: string;
  column?: string;
  issue: string;
  detail: string;
  suggestion?: string;
}

// Only tokens that are almost never a legitimate category. Deliberately EXCLUDES
// ambiguous values like 'na' (Namibia), 'none' (a real color), '-' (a separator)
// to avoid false positives — the worst kind of finding for a trust tool.
const SENTINELS = new Set([
  'n/a', '#n/a', '#n/a!', 'null', '#null!', 'nan',
  '#value!', '#ref!', '#div/0!', '#name?', '#num!',
  '-999', '-9999',
]);

function isNumericStr(s: string): boolean {
  const t = s.trim();
  return t !== '' && !Number.isNaN(Number(t));
}

function hasSpecialChars(name: string): boolean {
  return !/^[A-Za-z0-9_]+$/.test(name);
}

function looksLikeYear(col: DataColumn): boolean {
  if (/(^|[^a-z])(year|yr|fy)([^a-z]|$)/i.test(col.name)) return true;
  const vals = col.sampleValues ?? [];
  return vals.length > 0 && vals.every((v) => /^(1[89]|20)\d{2}(\.0+)?$/.test(v));
}

function isDatePartName(name: string): boolean {
  return /(^|_)(month|months|hour|hours|minute|minutes|second|seconds|day|days|week|weeks|time|date)(_|$)/i.test(name);
}

/** Profile-based data-quality checks for one table's columns. */
export function auditColumns(table: string, columns: DataColumn[], rowCount: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const add = (severity: QualitySeverity, column: string | undefined, issue: string, detail: string, suggestion?: string) =>
    findings.push({ severity, table, column, issue, detail, suggestion });

  for (const col of columns) {
    const total = col.totalCount || rowCount || 0;
    const nullRatio = total > 0 ? col.nullCount / total : 0;
    const samples = (col.sampleValues ?? []).filter((v) => v !== '' && v != null);
    const nonNull = total - col.nullCount;

    // ── Missing data ──
    if (total > 0 && col.nullCount === total) {
      add('high', col.name, 'all-null', `Column is entirely null (${total} rows) — carries no data.`,
        'Drop it, or fix the source if it should have values.');
    } else if (nullRatio > 0.5) {
      add('medium', col.name, 'mostly-null', `${Math.round(nullRatio * 100)}% of values are null (${col.nullCount}/${total}).`,
        'Aggregates skip nulls; segment-level analysis may be unreliable.');
    } else if (nullRatio > 0.2) {
      add('low', col.name, 'some-null', `${Math.round(nullRatio * 100)}% null (${col.nullCount}/${total}).`);
    }

    // ── Constant / no-variance ──
    // Only "constant" if the single value actually fills the column. A sparse
    // flag (e.g. 175 blanks + 2 'Y') has one distinct non-empty value but the
    // blank-vs-value distinction carries information — not a dead column.
    if (nonNull > 0 && col.uniqueCount === 1) {
      const topCount = col.topValues?.[0]?.count;
      const dominates = topCount === undefined ? true : total > 0 && topCount >= total * 0.9;
      if (dominates) {
        add('medium', col.name, 'constant', `Only one distinct value across ${total} rows — zero variance.`,
          'Carries no information for comparison or correlation.');
      }
    }

    // ── Type traps (the lexicographic / silent-wrong class) ──
    // Probe sample values AND top values so a numeric-looking head with a mixed
    // tail isn't missed.
    const typeProbe = [...new Set([...samples, ...(col.topValues?.map((t) => String(t.value)) ?? [])])].filter(
      (v) => v !== '' && v != null,
    );
    if ((col.type === 'categorical' || col.type === 'text') && typeProbe.length >= 3) {
      const numeric = typeProbe.filter(isNumericStr);
      const ratio = numeric.length / typeProbe.length;
      if (ratio >= 0.5 && ratio < 1) {
        const nonNumeric = typeProbe.filter((v) => !isNumericStr(v)).slice(0, 3);
        add('high', col.name, 'mixed-type',
          `Mixed numeric and non-numeric values (e.g. ${nonNumeric.join(', ')}) — column is text.`,
          'Numeric MAX/MIN/ORDER BY/comparisons will be lexicographic or wrong. Clean the non-numeric values (often sentinels) or CAST explicitly.');
      } else if (ratio === 1 && numeric.some((v) => /^-?0\d/.test(v.trim())) && !isDatePartName(col.name)) {
        const lz = numeric.filter((v) => /^-?0\d/.test(v.trim())).slice(0, 2);
        add('low', col.name, 'numeric-text',
          `All-numeric values stored as text, with leading zeros (e.g. ${lz.join(', ')}).`,
          'Fine for zero-padded codes (zip/SKU); just note numeric sort/compare on it is lexicographic.');
      }
    }

    // ── Missing-value sentinels hiding in categorical data ──
    const valuePool = (col.topValues?.map((t) => String(t.value)) ?? []).concat(samples);
    const sentinel = valuePool.find((v) => SENTINELS.has(v.trim().toLowerCase()));
    if (sentinel !== undefined && col.type !== 'numeric') {
      add('medium', col.name, 'sentinel-value',
        `Contains a likely missing-value sentinel: "${sentinel}".`,
        'These read as real categories — they inflate counts and skew group analysis. Treat as null.');
    }

    // ── Numeric outliers (advisory) ──
    if (col.type === 'numeric' && col.stats) {
      const { min, max, p25, p75 } = col.stats;
      const iqr = p75 - p25;
      if (iqr > 0) {
        const upper = p75 + 3 * iqr;
        const lower = p25 - 3 * iqr;
        if (max > upper || min < lower) {
          add('low', col.name, 'outliers',
            `Extreme values beyond 3×IQR (range ${fmt(min)}…${fmt(max)}, p25–p75 ${fmt(p25)}…${fmt(p75)}).`,
            'Verify they are genuine, not data-entry errors or missing-as-extreme.');
        }
      }
      // Zeros where a measurement should be positive (e.g. diamonds x/y/z = 0).
      if (min === 0 && /(^|_)(x|y|z|width|height|depth|length|weight|price|diameter|size)(_|$)/i.test(col.name)) {
        add('low', col.name, 'suspicious-zero',
          `Minimum is 0 for a measurement-like column.`,
          'A 0 here is often a missing/invalid value rather than a true zero.');
      }
    }

    // ── Identifier masquerading as a category ──
    // Require near-perfect uniqueness on a sizable column so naturally
    // high-variety categoricals (SKUs, composite labels) aren't mislabeled.
    if ((col.type === 'categorical' || col.type === 'text') && total >= 50 && nonNull > 0 && col.uniqueCount / nonNull >= 0.99) {
      add('low', col.name, 'id-like',
        `Essentially every value is unique (${col.uniqueCount}/${nonNull}) — looks like an identifier, not a category.`,
        'Grouping/coloring by it produces one bucket per row.');
    }

    // ── Footgun: column name needs quoting ──
    if (hasSpecialChars(col.name)) {
      add('low', col.name, 'special-char-name',
        `Name has spaces or special characters.`,
        'In --expr use backticks (`' + col.name + '`); in --sql use double quotes ("' + col.name + '").');
    }

    // ── Year columns (informational footgun note) ──
    if (col.type === 'date' && looksLikeYear(col)) {
      add('low', col.name, 'year-column',
        `Holds 4-digit years, not full dates.`,
        'Group by it directly — do not apply month/day date math (strftime) to it.');
    }

    // ── Non-ISO date columns (time-series footgun) ──
    if (col.type === 'date' && !looksLikeYear(col)) {
      const dvals = samples;
      const nonIso = dvals.filter((v) => !/^\d{4}-\d{2}-\d{2}/.test(v));
      if (dvals.length >= 3 && nonIso.length > 0) {
        add('medium', col.name, 'non-iso-date',
          `Looks like dates but not ISO YYYY-MM-DD (e.g. ${nonIso.slice(0, 2).join(', ')}).`,
          'Time bucketing (strftime) only parses ISO — non-ISO dates collapse to NULL, so analyze skips the trend. Reformat to YYYY-MM-DD for time-series analysis.');
      }
    }
  }

  return findings;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
