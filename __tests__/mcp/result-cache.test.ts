import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveResult, getResult, clearResultCache, resultCacheSize } from '../../src/mcp/tools/result-cache.js';

describe('result-cache', () => {
  beforeEach(() => {
    clearResultCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and retrieves a result', () => {
    const rows = [{ a: 1 }];
    const columns = [{ name: 'a', type: 'integer' }];
    const id = saveResult(rows, columns);
    expect(id).toMatch(/^qr-/);

    const result = getResult(id);
    expect(result).not.toBeNull();
    expect(result!.rows).toEqual(rows);
    expect(result!.columns).toEqual(columns);
  });

  it('returns null for unknown ID', () => {
    expect(getResult('qr-nonexistent')).toBeNull();
  });

  it('evicts oldest when at max capacity (20)', () => {
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      ids.push(saveResult([{ i }], [{ name: 'i', type: 'integer' }]));
    }
    expect(resultCacheSize()).toBe(20);

    // Adding one more should evict the oldest
    saveResult([{ i: 20 }], [{ name: 'i', type: 'integer' }]);
    expect(resultCacheSize()).toBe(20);
    expect(getResult(ids[0])).toBeNull();
    expect(getResult(ids[1])).not.toBeNull();
  });

  it('evicts expired entries (TTL 10 minutes)', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const id = saveResult([{ x: 1 }], [{ name: 'x', type: 'integer' }]);
    expect(getResult(id)).not.toBeNull();

    // Advance time past 10-minute TTL
    vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);

    // getResult triggers evictExpired
    expect(getResult(id)).toBeNull();
    expect(resultCacheSize()).toBe(0);
  });

  it('does not evict entries within TTL', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const id = saveResult([{ x: 1 }], [{ name: 'x', type: 'integer' }]);

    // Advance time to 9 minutes (within TTL)
    vi.spyOn(Date, 'now').mockReturnValue(now + 9 * 60 * 1000);

    expect(getResult(id)).not.toBeNull();
    expect(resultCacheSize()).toBe(1);
  });

  it('clearResultCache empties everything', () => {
    saveResult([{ a: 1 }], [{ name: 'a', type: 'integer' }]);
    saveResult([{ b: 2 }], [{ name: 'b', type: 'integer' }]);
    expect(resultCacheSize()).toBe(2);

    clearResultCache();
    expect(resultCacheSize()).toBe(0);
  });
});
