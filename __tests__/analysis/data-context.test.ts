import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  dataContextPath, loadDataContext, saveDataContext, renderDataContext, type DataContext,
} from '../../src/analysis/data-context.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dolex-ctx-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('data-context sidecar', () => {
  it('derives <base>.context.json beside the dataset', () => {
    expect(dataContextPath('/data/sales.csv')).toBe('/data/sales.context.json');
  });

  it('round-trips save → load', () => {
    const ds = path.join(dir, 'sales.csv');
    const ctx: DataContext = {
      dataset: 'sales',
      metrics: [{ name: 'MRR', definition: 'monthly recurring revenue', sql: 'SUM(amount) WHERE plan IS NOT NULL' }],
      standardFilters: [{ description: 'exclude test accounts', sql: "is_test = 0" }],
    };
    saveDataContext(ds, ctx);
    expect(fs.existsSync(dataContextPath(ds))).toBe(true);
    expect(loadDataContext(ds)).toEqual(ctx);
  });

  it('returns null for a missing or corrupt sidecar', () => {
    expect(loadDataContext(path.join(dir, 'absent.csv'))).toBeNull();
    const ds = path.join(dir, 'broken.csv');
    fs.writeFileSync(dataContextPath(ds), '{ not json');
    expect(loadDataContext(ds)).toBeNull();
  });

  it('renders only non-empty sections, and renders nothing for an empty context', () => {
    expect(renderDataContext(null)).toBe('');
    expect(renderDataContext({ dataset: 'x' })).toBe('');
    const out = renderDataContext({
      dataset: 'sales',
      metrics: [{ name: 'MRR', definition: 'monthly recurring revenue', sql: 'SUM(amount)' }],
      columnNotes: [{ column: 'ts', note: 'stored UTC' }],
    });
    expect(out).toContain('DOMAIN CONTEXT');
    expect(out).toContain('MRR');
    expect(out).toContain('stored UTC');
    expect(out).not.toContain('STANDARD FILTERS'); // omitted section
  });
});
