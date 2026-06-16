import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { persistSpec, loadSpec } from '../../src/cli/spec-disk.js';
import { refineCommand } from '../../src/cli/commands/refine.js';

function silence(): () => void {
  const o = process.stdout.write.bind(process.stdout);
  const e = process.stderr.write.bind(process.stderr);
  process.stdout.write = (() => true) as any;
  process.stderr.write = (() => true) as any;
  return () => {
    process.stdout.write = o as any;
    process.stderr.write = e as any;
  };
}

function seedSpec(hash: string) {
  const spec = {
    pattern: 'bar',
    title: 'Original',
    data: [
      { cat: 'A', val: 10 },
      { cat: 'B', val: 20 },
      { cat: 'C', val: 5 },
    ],
    encoding: {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'val', type: 'quantitative' },
    },
    config: {},
  } as any;
  const columns = [
    { name: 'cat', type: 'categorical', sampleValues: ['A', 'B', 'C'], uniqueCount: 3, nullCount: 0, totalCount: 3 },
    { name: 'val', type: 'numeric', sampleValues: ['10', '20', '5'], uniqueCount: 3, nullCount: 0, totalCount: 3 },
  ] as any;
  persistSpec(hash, { spec, columns, alternatives: new Map(), originalData: spec.data });
}

describe('refine: hash-explicit persistence (no shared "last" pointer)', () => {
  let home: string;
  let prev: string | undefined;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'dolex-home-'));
    prev = process.env.DOLEX_HOME;
    process.env.DOLEX_HOME = home;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.DOLEX_HOME;
    else process.env.DOLEX_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  });

  it('persistSpec keys files only by hash and never writes a "last" pointer', () => {
    seedSpec('spec-testabcd');
    const specsDir = join(home, 'specs');
    const files = readdirSync(specsDir);
    expect(files).toContain('spec-testabcd.json');
    expect(files).not.toContain('last'); // the concurrency-hazard pointer must not exist
    expect(files.every((f) => f.endsWith('.json'))).toBe(true); // no stray temp files
    expect(loadSpec('spec-testabcd')).not.toBeNull();
  });

  it('refines a chart by its explicit hash', async () => {
    seedSpec('spec-testabcd');
    const restore = silence();
    try {
      expect(await refineCommand(['spec-testabcd', '--title', 'Renamed'])).toBe(0);
    } finally {
      restore();
    }
    // still no shared pointer after a refine
    expect(readdirSync(join(home, 'specs'))).not.toContain('last');
  });

  it('accepts the hash with the spec- prefix omitted', async () => {
    seedSpec('spec-testabcd');
    const restore = silence();
    try {
      expect(await refineCommand(['testabcd', '--limit', '2'])).toBe(0);
    } finally {
      restore();
    }
  });

  it('fails cleanly on an unknown hash', async () => {
    const restore = silence();
    try {
      expect(await refineCommand(['spec-deadbeef', '--title', 'X'])).toBe(1);
    } finally {
      restore();
    }
  });

  it('fails when no hash is given (there is no implicit "last")', async () => {
    seedSpec('spec-testabcd'); // a spec exists, but refine must NOT auto-pick it
    const restore = silence();
    try {
      expect(await refineCommand(['--title', 'X'])).toBe(1);
    } finally {
      restore();
    }
  });

  it('rejects a path-traversal hash', async () => {
    const restore = silence();
    try {
      expect(await refineCommand(['../../../etc/passwd', '--title', 'X'])).toBe(1);
    } finally {
      restore();
    }
  });
});
