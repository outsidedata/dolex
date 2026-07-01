import type { z } from 'zod';
import { connectAndValidateTable, isTransformError, errorResponse, jsonResponse } from './shared.js';
import type { cleanColumnSchema } from './clean-schemas.js';
import { pythonAvailable, runPythonClean, cleanStats, safetyVerdict, previewSample, applyCleanColumn } from '../../cleaning/exec.js';

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function handleCleanColumn(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof cleanColumnSchema>) => {
    const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
    if (isTransformError(ctx)) return ctx;
    if (!ctx.db) return errorResponse(`clean_column runs a Python clean() over CSV-backed rows. On a live ${ctx.source.type} source, express the fix as a derived column via transform_data using a native ${ctx.source.type === 'mongodb' ? 'aggregation ($set) expression' : 'SQL expression'} — non-destructive and server-side.`);

    const colNames = ctx.table.columns.map((c: any) => c.name);
    if (!colNames.includes(args.column)) return errorResponse(`Column '${args.column}' not found. Available: [${colNames.join(', ')}]`);
    const newColumn = args.newColumn ?? `${args.column}_clean`;
    if (colNames.includes(newColumn)) return errorResponse(`Column '${newColumn}' already exists. Pass a different newColumn or drop it first.`);
    if (!pythonAvailable()) return errorResponse('clean_column requires python3 on PATH (not found). Install Python 3 to use this tool.');

    const rows = ctx.db.prepare(`SELECT rowid AS __rid, ${q(args.column)} AS v FROM ${q(args.table)}`).all() as any[];
    const rowids = rows.map((r) => r.__rid as number);
    // Canonicalize blanks to null on the way IN: the CSV connector stores an empty cell as ''
    // but treats '' as missing everywhere else, so clean(value) sees None for an empty cell.
    const raw = rows.map((r) => (r.v === null || r.v === '' ? null : String(r.v)));

    let cleaned: (string | null)[]; let errors: number;
    try { ({ cleaned, errors } = runPythonClean(args.code, raw)); }
    catch (e: any) { return errorResponse(`clean() failed to run: ${e?.message ?? String(e)}`); }
    // Canonicalize blanks to null on the way OUT too, so stats/preview report exactly what
    // applyCleanColumn writes (it stores '' as NULL). One canonical form across the pipeline.
    cleaned = cleaned.map((v) => (v === '' ? null : v));

    const stats = { ...cleanStats(raw, cleaned), errors };
    const safety = safetyVerdict(raw, cleaned, errors);
    const sample = previewSample(raw, cleaned, 20);
    if (!safety.ok) return errorResponse(`clean() rejected: ${safety.reason}. (nothing was applied)`);

    if (!args.apply) {
      return jsonResponse({ preview: true, column: args.column, newColumn, stats, sample, note: 'Preview only — pass apply:true to write the cleaned column (non-destructive; original kept).' });
    }
    applyCleanColumn(ctx.db, args.table, newColumn, rowids, cleaned);
    ctx.source.invalidateSchema?.();
    return jsonResponse({ applied: true, column: args.column, newColumn, stats, sample });
  };
}
