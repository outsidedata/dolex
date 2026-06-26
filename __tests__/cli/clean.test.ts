import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';
import { pythonAvailable } from '../../src/cleaning/exec.js';
import { cleanCommand } from '../../src/cli/commands/clean.js';

const py = pythonAvailable() ? describe : describe.skip;
let tmp: string, logs: string[];
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-clean-')); logs = []; vi.spyOn(process.stdout, 'write').mockImplementation((s: any) => { logs.push(String(s)); return true; }); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(tmp, { recursive: true, force: true }); });

py('dolex clean', () => {
  it('previews a caller-authored fix without writing', async () => {
    const csv = path.join(tmp, 'g.csv'); fs.writeFileSync(csv, 'd\n9/2/1966\n1/15/2012');
    const fix = path.join(tmp, 'fix.py'); fs.writeFileSync(fix, 'import datetime\ndef clean(value):\n    return datetime.datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%d")');
    const code = await cleanCommand([csv, '--column', 'd', '--code-file', fix]);
    expect(code).toBe(0);
    expect(logs.join('\n')).toMatch(/1966-09-02/);              // before→after shown
    expect(fs.existsSync(path.join(tmp, 'g.clean.csv'))).toBe(false); // no write on preview
  });

  it('--apply materializes a cleaned CSV (raw kept) + manifest', async () => {
    const csv = path.join(tmp, 'g.csv'); fs.writeFileSync(csv, 'd\n9/2/1966');
    const fix = path.join(tmp, 'fix.py'); fs.writeFileSync(fix, 'import datetime\ndef clean(value):\n    return datetime.datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%d")');
    const code = await cleanCommand([csv, '--column', 'd', '--code-file', fix, '--apply']);
    expect(code).toBe(0);
    const out = fs.readFileSync(path.join(tmp, 'g.clean.csv'), 'utf8');
    expect(out).toMatch(/1966-09-02/); expect(out).toMatch(/d_raw/);
    expect(fs.existsSync(path.join(tmp, 'g.cleanfix.json'))).toBe(true);
  });
});
