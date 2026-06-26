import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleCleanColumn } from '../../src/mcp/tools/clean-column.js';
import { pythonAvailable } from '../../src/cleaning/exec.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';

const parse = (r: any) => JSON.parse(r.content[0].text);
const py = pythonAvailable() ? describe : describe.skip;

py('clean_column MCP tool', () => {
  let sourceManager: SourceManager; let tmpDir: string; let sourceId: string;
  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-'));
    const csv = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csv, 'college\nKentucky\nNone\nDuke\nNone');
    sourceManager = new SourceManager();
    sourceId = (await sourceManager.add('test', { type: 'csv', path: csv })).entry!.id;
  });
  afterEach(async () => { await sourceManager.closeAll(); fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const CODE = "def clean(value):\n    return None if value == 'None' else value";

  it('previews without writing (apply omitted)', async () => {
    const r = await handleCleanColumn({ sourceManager })({ sourceId, table: 'data', column: 'college', code: CODE } as any);
    const b = parse(r);
    expect(b.preview).toBe(true);
    expect(b.stats.nulledFromValue).toBe(2);
    expect(b.sample).toContainEqual({ before: 'None', after: null });
    const cols = (await sourceManager.querySql(sourceId, 'SELECT * FROM data')).columns!; // string[]
    expect(cols).toContain('college');             // real column present (proves the check can fail)
    expect(cols).not.toContain('college_clean');   // not written
  });

  it('applies non-destructively (apply:true)', async () => {
    const r = await handleCleanColumn({ sourceManager })({ sourceId, table: 'data', column: 'college', code: CODE, apply: true } as any);
    expect(parse(r).applied).toBe(true);
    const rows = (await sourceManager.querySql(sourceId, 'SELECT college, college_clean FROM data')).rows!;
    expect(rows).toContainEqual({ college: 'None', college_clean: null });
    expect(rows).toContainEqual({ college: 'Kentucky', college_clean: 'Kentucky' });
  });

  it('preview and apply agree when clean() returns empty string — both report/write NULL (F2/F3)', async () => {
    // college has 'None' sentinels; map a real value to '' → must surface as null in preview AND write null.
    const code = "def clean(value):\n    return '' if value == 'Duke' else value";
    const prev = parse(await handleCleanColumn({ sourceManager })({ sourceId, table: 'data', column: 'college', code } as any));
    // preview must show after:null (not after:'') so it matches what apply writes
    expect(prev.sample).toContainEqual({ before: 'Duke', after: null });
    expect(prev.sample).not.toContainEqual({ before: 'Duke', after: '' });
    expect(prev.stats.nulledFromValue).toBe(1); // Duke→null counts as a real-value nulled

    const r = await handleCleanColumn({ sourceManager })({ sourceId, table: 'data', column: 'college', code, apply: true } as any);
    expect(parse(r).applied).toBe(true);
    const rows = (await sourceManager.querySql(sourceId, "SELECT college_clean FROM data WHERE college = 'Duke'")).rows!;
    expect(rows).toEqual([{ college_clean: null }]); // written as NULL, matching the preview
  });

  it('rejects a destructive fix (blanks everything)', async () => {
    const r = await handleCleanColumn({ sourceManager })({ sourceId, table: 'data', column: 'college', code: 'def clean(value):\n    return None', apply: true } as any);
    expect(r.isError).toBe(true);
    expect(parse(r).error).toMatch(/blank|null/i);
  });
});
