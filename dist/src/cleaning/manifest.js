/**
 * Manifest build (discover → author[injected] → acceptance-test → store) + replay
 * (deterministic, no model). The model-free heart of the cleaning core.
 *
 * Ported from local-orchestration/src/clean.ts with two changes: the model author
 * is INJECTED (CleanAuthor) so the core stays model-free, and the python runner is
 * the shared exec (runPythonClean) so there is exactly ONE executor.
 */
import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { SourceManager } from '../connectors/manager.js';
import { auditDataset } from '../analysis/quality.js';
import { runPythonClean } from './exec.js';
import { HANDLERS, validateFix } from './handlers.js';
export async function buildCleanManifest(rawPath, author, opts = {}) {
    const log = opts.onLog ?? (() => { });
    const tries = opts.tries ?? 3;
    const rows = Papa.parse(fs.readFileSync(rawPath, 'utf8'), { header: true, skipEmptyLines: true }).data;
    const mgr = new SourceManager();
    const add = await mgr.add('ds', { type: 'csv', path: rawPath });
    const sid = add.entry.id;
    await mgr.connect(sid);
    const tables = (await mgr.getSchema(sid)).schema.tables;
    const findings = await auditDataset(tables, (s) => mgr.querySql(sid, s));
    const manifest = { dataset: path.basename(rawPath), createdBy: opts.createdBy ?? 'injected-author', createdAt: '', fixes: [] };
    for (const f of findings) {
        const handler = f.column ? HANDLERS[f.issue] : undefined;
        if (!handler)
            continue;
        const task = handler.task(f);
        if (!task)
            continue;
        if (manifest.fixes.some((x) => x.column === f.column))
            continue; // one fix per column
        const sampleVals = [...new Set(rows.map((r) => r[f.column]).filter((v) => v !== undefined))].slice(0, 200);
        // the acceptance test must SEE the sentinel/edge value or it can't validate the fix —
        // the first-200-distinct sample may miss a rare sentinel (e.g. odometer 999999).
        const sentinel = (f.detail.match(/non-numeric value "([^"]+)"/) || f.detail.match(/Extreme value ([\d.eE+-]+)/) || f.detail.match(/sentinel:\s*"([^"]+)"/) || [])[1];
        if (sentinel !== undefined && !sampleVals.includes(sentinel))
            sampleVals.push(sentinel);
        const samples = sampleVals.slice(0, 4);
        let feedback, stored = false;
        for (let attempt = 1; attempt <= tries; attempt++) {
            let code;
            try {
                code = await author({ column: f.column, issue: f.issue, task, samples, feedback });
            }
            catch (e) {
                log(`  ${f.column} attempt ${attempt}: author error ${e?.message}`);
                continue;
            }
            let acc;
            try {
                acc = validateFix(f, code, sampleVals);
            }
            catch (e) {
                acc = { ok: false, summary: 'python error', fail: String(e?.message || e).slice(0, 80) };
            }
            log(`  ${f.column} (${f.issue}) attempt ${attempt}: ${acc.summary} → ${acc.ok ? 'VALID' : 'FAIL ' + (acc.fail ?? '')}`);
            if (acc.ok) {
                manifest.fixes.push({ column: f.column, issue: f.issue, task, pythonCode: code, validated: true, summary: acc.summary });
                stored = true;
                break;
            }
            feedback = acc.fail;
        }
        if (!stored)
            log(`  ${f.column}: no valid fix after ${tries} tries — skipped (never store an unvalidated fix)`);
    }
    return manifest;
}
/** Replay validated fixes over a CSV (NON-destructive: keep <col>_raw). NO model. */
export function applyManifest(rawPath, manifest) {
    const parsed = Papa.parse(fs.readFileSync(rawPath, 'utf8'), { header: true, skipEmptyLines: true });
    const rows = parsed.data;
    for (const fix of manifest.fixes) {
        const { cleaned } = runPythonClean(fix.pythonCode, rows.map((r) => r[fix.column] ?? ''));
        rows.forEach((r, i) => { r[`${fix.column}_raw`] = r[fix.column] ?? ''; r[fix.column] = cleaned[i] === null || cleaned[i] === undefined ? '' : String(cleaned[i]); });
    }
    const fields = [...(parsed.meta.fields || []), ...manifest.fixes.map((f) => `${f.column}_raw`)];
    return { rows, fields };
}
/** Full activation: build manifest (via injected author) → materialize cleaned CSV + persist manifest. */
export async function cleanDataset(rawPath, author, opts = {}) {
    const manifest = await buildCleanManifest(rawPath, author, { onLog: opts.onLog, createdBy: opts.createdBy });
    const outDir = opts.outDir ?? path.dirname(rawPath);
    const base = path.basename(rawPath, path.extname(rawPath));
    const manifestPath = path.join(outDir, `${base}.cleanfix.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const { rows, fields } = applyManifest(rawPath, manifest);
    const cleanedPath = path.join(outDir, `${base}.clean.csv`);
    fs.writeFileSync(cleanedPath, Papa.unparse(rows, { columns: fields }));
    return { cleanedPath, manifestPath, manifest };
}
