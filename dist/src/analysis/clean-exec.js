/**
 * Data-cleaning execution core (no MCP, no SourceManager) — runs a model-authored
 * Python clean(value) over a column's values and applies the result non-destructively.
 * SECURITY: executes model Python via python3. Local-self-run trust model only;
 * a hosted deployment must sandbox this.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
export function pythonAvailable() {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
export function runPythonClean(code, values) {
    const dir = mkdtempSync(join(tmpdir(), 'dolex-clean-'));
    try {
        const vf = join(dir, 'v.json');
        writeFileSync(vf, JSON.stringify(values));
        const sf = join(dir, 'c.py');
        writeFileSync(sf, `${code}\n\nimport json, sys\n` +
            `vals = json.load(open(sys.argv[1]))\n` +
            `out = []\nerr = 0\n` +
            `for v in vals:\n` +
            `    try:\n        r = clean(v)\n        out.append(None if r is None else str(r))\n` +
            `    except Exception:\n        err += 1\n        out.append(None)\n` +
            `print(json.dumps({"cleaned": out, "errors": err}))\n`);
        const raw = execFileSync('python3', [sf, vf], { timeout: 60000, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
        const parsed = JSON.parse(raw);
        return { cleaned: parsed.cleaned, errors: parsed.errors };
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
const isBlank = (x) => x === null || x === '' || x === undefined;
export function cleanStats(raw, cleaned) {
    let changed = 0, nulledFromValue = 0;
    for (let i = 0; i < raw.length; i++) {
        if (String(raw[i] ?? '') !== String(cleaned[i] ?? ''))
            changed++;
        if (!isBlank(raw[i]) && isBlank(cleaned[i]))
            nulledFromValue++;
    }
    return {
        rows: raw.length, errors: 0, changed, nulledFromValue,
        distinctBefore: new Set(raw.filter((v) => !isBlank(v))).size,
        distinctAfter: new Set(cleaned.filter((v) => !isBlank(v))).size,
    };
}
export function safetyVerdict(raw, cleaned, errors) {
    const rows = raw.length;
    if (rows === 0)
        return { ok: false, reason: 'no rows to clean' };
    if (errors > rows * 0.5)
        return { ok: false, reason: `the function errored on ${errors}/${rows} rows` };
    const nonBlankBefore = raw.filter((v) => !isBlank(v)).length;
    const nonBlankAfter = cleaned.filter((v) => !isBlank(v)).length;
    if (nonBlankBefore > 0 && nonBlankAfter === 0)
        return { ok: false, reason: 'every value became blank/null — the function likely destroyed the column' };
    return { ok: true };
}
export function previewSample(raw, cleaned, n) {
    const out = [];
    for (let i = 0; i < raw.length && out.length < n; i++) {
        if (String(raw[i] ?? '') !== String(cleaned[i] ?? ''))
            out.push({ before: raw[i], after: cleaned[i] });
    }
    return out;
}
const q = (s) => `"${s.replace(/"/g, '""')}"`;
export function applyCleanColumn(db, table, newColumn, rowids, cleaned) {
    db.exec(`ALTER TABLE ${q(table)} ADD COLUMN ${q(newColumn)}`);
    const upd = db.prepare(`UPDATE ${q(table)} SET ${q(newColumn)} = ? WHERE rowid = ?`);
    const tx = db.transaction((pairs) => {
        // '' = missing — match the connector's "empty string is null" convention so the
        // stored value agrees with stats/safety (which treat '' as blank). [second-look fix]
        for (const [val, rid] of pairs)
            upd.run(val === '' ? null : val, rid);
    });
    tx(cleaned.map((v, i) => [v, rowids[i]]));
}
