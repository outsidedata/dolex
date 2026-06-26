/**
 * `dolex clean` — remediate a column with a CALLER-AUTHORED Python clean(value)
 * (the CLI twin of the MCP clean_column tool). Preview by default; --apply
 * materializes a non-destructive cleaned CSV (<col>_raw kept) + a replayable
 * manifest. --apply-manifest replays an existing manifest with no code.
 * Authoring is the caller's job — the command never calls a model.
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, basename, join, resolve } from 'path';
import Papa from 'papaparse';
import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { pythonAvailable, runPythonClean, cleanStats, safetyVerdict, previewSample, applyManifest, } from '../../cleaning/index.js';
const BOOLEANS = ['apply', 'help'];
const ALIASES = { h: 'help', c: 'column' };
export async function cleanCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const target = args._[0];
    if (!target) {
        o.fail('Usage: dolex clean <csv> --column <col> --code-file <fix.py> [--apply]');
        return 1;
    }
    if (!pythonAvailable()) {
        o.fail('dolex clean requires python3 on PATH (not found).');
        return 1;
    }
    const manifestArg = str(args, 'apply-manifest');
    if (manifestArg !== undefined)
        return replay(target, manifestArg);
    const column = str(args, 'column');
    const codeFile = str(args, 'code-file');
    if (!column || !codeFile) {
        o.fail('Pass --column <col> and --code-file <fix.py> (the caller authors the clean()).');
        return 1;
    }
    const code = readFileSync(resolve(codeFile), 'utf8');
    // Read the column's values through the shared opener.
    const opened = await openTarget(target, {});
    try {
        const tableName = opened.defaultTable;
        const q = await opened.query(`SELECT "${column.replace(/"/g, '""')}" AS v FROM "${tableName.replace(/"/g, '""')}"`, 1_000_000);
        if (!q.ok) {
            o.fail(`could not read column "${column}": ${q.error}`);
            return 1;
        }
        const raw = (q.rows ?? []).map((r) => (r.v === null || r.v === '' ? null : String(r.v)));
        let cleaned;
        let errors;
        try {
            ({ cleaned, errors } = runPythonClean(code, raw));
        }
        catch (e) {
            o.fail(`clean() rejected: ${e?.message ?? String(e)} (nothing written)`);
            return 1;
        }
        const norm = cleaned.map((v) => (v === '' ? null : v));
        const stats = { ...cleanStats(raw, norm), errors };
        const safety = safetyVerdict(raw, norm, errors);
        const sample = previewSample(raw, norm, 20);
        o.heading(`dolex clean — ${opened.displayName}.${column}`);
        o.hint(`${stats.changed} changed · ${stats.nulledFromValue} nulled · ${errors} errors · ${stats.distinctBefore}→${stats.distinctAfter} distinct`);
        for (const s of sample.slice(0, 10))
            o.out(`  ${JSON.stringify(s.before)} → ${JSON.stringify(s.after)}`);
        if (!safety.ok) {
            o.fail(`rejected: ${safety.reason} (nothing written)`);
            return 1;
        }
        if (!bool(args, 'apply')) {
            o.hint('Preview only — pass --apply to write <base>.clean.csv (non-destructive).');
            return 0;
        }
        // --apply: materialize via a single-fix manifest over the source CSV file.
        const csvPath = resolve(target);
        const fix = { column, issue: str(args, 'issue') ?? 'manual', task: 'caller-authored', pythonCode: code, validated: true, summary: `${stats.changed} changed` };
        const manifest = { dataset: basename(csvPath), createdBy: 'dolex clean', createdAt: '', fixes: [fix] };
        const { rows, fields } = applyManifest(csvPath, manifest);
        const outArg = str(args, 'out');
        const outDir = outArg ? dirname(resolve(outArg)) : dirname(csvPath);
        const base = basename(csvPath, '.csv');
        const cleanedPath = outArg ? resolve(outArg) : join(outDir, `${base}.clean.csv`);
        writeFileSync(cleanedPath, Papa.unparse(rows, { columns: fields }));
        writeFileSync(join(outDir, `${base}.cleanfix.json`), JSON.stringify(manifest, null, 2));
        o.success(`wrote ${cleanedPath} (+ ${base}.cleanfix.json), original column kept as ${column}_raw`);
        return 0;
    }
    finally {
        await opened.close();
    }
}
function replay(target, manifestPath) {
    const csvPath = resolve(target);
    const mPath = manifestPath || join(dirname(csvPath), `${basename(csvPath, '.csv')}.cleanfix.json`);
    const manifest = JSON.parse(readFileSync(resolve(mPath), 'utf8'));
    const { rows, fields } = applyManifest(csvPath, manifest);
    const cleanedPath = join(dirname(csvPath), `${basename(csvPath, '.csv')}.clean.csv`);
    writeFileSync(cleanedPath, Papa.unparse(rows, { columns: fields }));
    o.success(`replayed ${manifest.fixes.length} fix(es) → ${cleanedPath} (no model)`);
    return 0;
}
function printHelp() {
    o.out(`${o.c.bold('dolex clean')} — remediate a column with a Python clean() you (the caller) write

${o.c.bold('USAGE')}
  dolex clean <csv> --column <col> --code-file <fix.py> [--apply] [--out <path>] [--issue <type>]
  dolex clean <csv> --apply-manifest [<manifest.cleanfix.json>]

${o.c.dim('Preview by default (before→after + stats, no write). --apply materializes')}
${o.c.dim('<base>.clean.csv + <base>.cleanfix.json, keeping the original as <col>_raw.')}
${o.c.dim("Authoring the clean() is the caller's job — this command never calls a model. Requires python3.")}`);
}
