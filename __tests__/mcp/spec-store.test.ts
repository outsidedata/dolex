import { describe, it, expect, beforeEach } from 'vitest';
import { SpecStore } from '../../src/mcp/spec-store.js';
import type { VisualizationSpec } from '../../src/types.js';

function makeSpec(pattern: string): VisualizationSpec {
  return {
    pattern,
    title: `Test ${pattern}`,
    data: [{ x: 1, y: 2 }],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    config: {},
  };
}

describe('SpecStore', () => {
  let store: SpecStore;

  beforeEach(() => {
    store = new SpecStore();
  });

  it('save returns a spec-prefixed ID', () => {
    const id = store.save(makeSpec('bar'), []);
    expect(id).toMatch(/^spec-[a-f0-9]{8}$/);
  });

  it('get retrieves a stored spec', () => {
    const spec = makeSpec('bar');
    const id = store.save(spec, []);
    const stored = store.get(id);
    expect(stored).not.toBeNull();
    expect((stored!.spec as VisualizationSpec).pattern).toBe('bar');
  });

  it('get returns null for unknown ID', () => {
    expect(store.get('spec-nonexist')).toBeNull();
  });

  it('saves and retrieves alternatives', () => {
    const spec = makeSpec('bar');
    const alts = new Map<string, VisualizationSpec>();
    alts.set('line', makeSpec('line'));
    alts.set('area', makeSpec('area'));

    const id = store.save(spec, [], alts);
    expect(store.getAlternative(id, 'line')!.pattern).toBe('line');
    expect(store.getAlternative(id, 'area')!.pattern).toBe('area');
    expect(store.getAlternative(id, 'scatter')).toBeNull();
  });

  it('getAlternative returns null for unknown specId', () => {
    expect(store.getAlternative('spec-bad', 'line')).toBeNull();
  });

  it('updateSpec creates a new ID and stores new spec', () => {
    const id1 = store.save(makeSpec('bar'), []);
    const id2 = store.updateSpec(id1, makeSpec('line'));
    expect(id2).not.toBe(id1);
    expect((store.get(id2)!.spec as VisualizationSpec).pattern).toBe('line');
  });

  it('updateSpec preserves columns and alternatives from original', () => {
    const cols = [{ name: 'x', type: 'numeric' as const, sampleValues: [], uniqueCount: 1, nullCount: 0, totalCount: 1 }];
    const alts = new Map<string, VisualizationSpec>();
    alts.set('scatter', makeSpec('scatter'));

    const id1 = store.save(makeSpec('bar'), cols, alts);
    const id2 = store.updateSpec(id1, makeSpec('line'));

    const stored = store.get(id2)!;
    expect(stored.columns).toHaveLength(1);
    expect(stored.columns[0].name).toBe('x');
    expect(stored.alternatives.get('scatter')!.pattern).toBe('scatter');
  });

  it('evicts oldest entry when at capacity', () => {
    const ids: string[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(store.save(makeSpec(`pattern-${i}`), []));
    }
    expect(store.size).toBe(100);

    // Adding one more should evict the first
    store.save(makeSpec('overflow'), []);
    expect(store.size).toBe(100);
    expect(store.get(ids[0])).toBeNull();
    expect(store.get(ids[1])).not.toBeNull();
  });
});
