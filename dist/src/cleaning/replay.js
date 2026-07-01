/**
 * Cleanfix replay — the model-free, SourceManager-free half of the cleaning core. Lives in
 * its own module so the CSV connector can replay a cleanfix manifest at load time WITHOUT
 * pulling in SourceManager (manifest.ts → SourceManager → connectors → manifest.ts would be
 * a cycle). Imports only papaparse + the python executor.
 *
 * The manifest (`<base>.cleanfix.json`) is the durable recipe: replaying it over the CURRENT
 * raw CSV is what gives newly-arrived rows the same treatment as the data it was authored on.
 */
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { runPythonClean } from './exec.js';
const blank = (x) => x === null || x === '' || x === undefined;
export function parseCsv(p) {
    const parsed = Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: true });
    return { rows: parsed.data, fields: parsed.meta.fields || [] };
}
/** Apply validated fixes to in-memory rows (mutates). When `keepRaw`, also writes a
 *  `<col>_raw` provenance column from the value the fix saw before overwriting `<col>`.
 *  The autoclean loop applies with keepRaw=false (provenance columns re-trigger the healed
 *  findings on re-audit); materialization keeps it for lineage. */
export function applyFixesToRows(rows, fixes, keepRaw = true) {
    for (const fix of fixes) {
        if (rows.length > 0 && !(fix.column in rows[0]))
            continue; // column gone (renamed/dropped) — skip gracefully
        const { cleaned } = runPythonClean(fix.pythonCode, rows.map((r) => r[fix.column] ?? ''));
        rows.forEach((r, i) => { if (keepRaw)
            r[`${fix.column}_raw`] = r[fix.column] ?? ''; r[fix.column] = blank(cleaned[i]) ? '' : String(cleaned[i]); });
    }
}
/** Replay validated fixes over a CSV. NO model. `keepRaw` retains `<col>_raw` lineage. */
export function applyManifest(rawPath, manifest, keepRaw = true) {
    const { rows, fields } = parseCsv(rawPath);
    const present = manifest.fixes.filter((f) => rows.length === 0 || f.column in rows[0]);
    applyFixesToRows(rows, manifest.fixes, keepRaw);
    return { rows, fields: keepRaw ? [...fields, ...present.map((f) => `${f.column}_raw`)] : fields };
}
/** `<base>.cleanfix.json` co-located with the CSV (matches cleanDataset's default outDir). */
export function resolveCleanfixPath(csvPath) {
    return path.join(path.dirname(csvPath), `${path.basename(csvPath, path.extname(csvPath))}.cleanfix.json`);
}
/** Read + shape-validate a cleanfix manifest. Returns null if absent/invalid/empty. */
export function readCleanfixManifest(csvPath) {
    try {
        const p = resolveCleanfixPath(csvPath);
        if (!fs.existsSync(p))
            return null;
        const m = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!m || !Array.isArray(m.fixes))
            return null;
        const fixes = m.fixes.filter((f) => f && f.validated && f.column && f.pythonCode);
        return fixes.length > 0 ? { ...m, fixes } : null;
    }
    catch {
        return null;
    }
}
