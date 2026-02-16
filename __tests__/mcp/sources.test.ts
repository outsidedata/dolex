import { describe, it, expect, vi } from 'vitest';
import {
  handleListSources,
  handleAddSource,
  handleRemoveSource,
  handleDescribeSource,
  isSandboxPath,
} from '../../src/mcp/tools/sources.js';

/**
 * Helper: build a mock SourceManager with sensible defaults.
 * Each test can override specific methods as needed.
 */
function makeMockManager(overrides: Record<string, any> = {}) {
  const mockSource = {
    getSampleRows: vi.fn().mockResolvedValue([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]),
  };

  return {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    add: vi.fn().mockResolvedValue({
      ok: true,
      entry: { id: 'src-123', name: 'test', type: 'csv' },
    }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    connect: vi.fn().mockResolvedValue({ ok: true, source: mockSource }),
    getSchema: vi.fn().mockResolvedValue({
      ok: true,
      schema: {
        tables: [{
          name: 'data',
          rowCount: 3,
          columns: [
            { name: 'id', type: 'integer', nullCount: 0, uniqueCount: 3, stats: { min: 1, max: 3, mean: 2 }, sampleValues: [1, 2, 3] },
            { name: 'name', type: 'text', nullCount: 0, uniqueCount: 3, topValues: [{ value: 'Alice', count: 1 }, { value: 'Bob', count: 1 }], sampleValues: ['Alice', 'Bob', 'Carol'] },
          ],
        }],
      },
    }),
    _mockSource: mockSource,
    ...overrides,
  };
}


// ─── handleListSources ──────────────────────────────────────────────────────

describe('handleListSources', () => {
  it('returns empty array when no sources exist', async () => {
    const manager = makeMockManager({ list: vi.fn().mockReturnValue([]) });
    const handler = handleListSources({ sourceManager: manager });
    const result = await handler();

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const body = JSON.parse(result.content[0].text);
    expect(body).toEqual([]);
    expect(manager.list).toHaveBeenCalledOnce();
  });

  it('returns list of sources when entries exist', async () => {
    const entries = [
      { id: 'src-1', name: 'sales', type: 'csv' },
      { id: 'src-2', name: 'users', type: 'sqlite' },
    ];
    const manager = makeMockManager({ list: vi.fn().mockReturnValue(entries) });
    const handler = handleListSources({ sourceManager: manager });
    const result = await handler();

    const body = JSON.parse(result.content[0].text);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('sales');
    expect(body[1].name).toBe('users');
  });
});


// ─── handleAddSource ─────────────────────────────────────────────────────────

describe('handleAddSource', () => {
  it('reconnects when source already exists by name', async () => {
    const existingEntry = { id: 'src-existing', name: 'mydata', type: 'csv' };
    const manager = makeMockManager({
      get: vi.fn().mockReturnValue(existingEntry),
    });

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'mydata',
      type: 'csv',
      config: { type: 'csv' as const, path: '/tmp/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    // Should use the existing entry
    expect(body.sourceId).toBe('src-existing');
    expect(body.name).toBe('mydata');
    expect(body.message).toContain('Reconnected');
    // add() should NOT have been called since we reconnected
    expect(manager.add).not.toHaveBeenCalled();
    // getSchema and connect should have been called with the existing id
    expect(manager.getSchema).toHaveBeenCalledWith('src-existing');
    expect(manager.connect).toHaveBeenCalledWith('src-existing');
  });

  it('returns error when sourceManager.add() throws', async () => {
    const manager = makeMockManager({
      add: vi.fn().mockRejectedValue(new Error('Connection refused')),
    });

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'baddb',
      type: 'postgres',
      config: { type: 'postgres' as const, host: 'localhost', port: 5432, database: 'nope', user: 'u', password: 'p' },
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Connection refused');
  });

  it('returns ENOENT guidance when file not found', async () => {
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    const manager = makeMockManager({
      add: vi.fn().mockRejectedValue(enoent),
    });

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'missing',
      type: 'csv',
      config: { type: 'csv' as const, path: '/Users/bill/Downloads/nonexistent.csv' },
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('File not found');
    expect(body.error).toContain('/Users/bill/Downloads/nonexistent.csv');
    expect(body.error).toContain('double-check the path');
  });

  it('returns error when sourceManager.add() returns ok: false', async () => {
    const manager = makeMockManager({
      add: vi.fn().mockResolvedValue({ ok: false, error: 'Duplicate name' }),
    });

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'dup',
      type: 'csv',
      config: { type: 'csv' as const, path: '/tmp/dup.csv' },
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Duplicate name');
  });

  it('uses compact detail to build table profiles without stats or sampleRows', async () => {
    const manager = makeMockManager();

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/tmp/data.csv' },
      detail: 'compact',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    const table = body.tables[0];
    expect(table.name).toBe('data');
    expect(table.rowCount).toBe(3);
    // Compact: columns should only have name and type
    for (const col of table.columns) {
      expect(col).toHaveProperty('name');
      expect(col).toHaveProperty('type');
      expect(col).not.toHaveProperty('stats');
      expect(col).not.toHaveProperty('topValues');
      expect(col).not.toHaveProperty('sample');
      expect(col).not.toHaveProperty('nullCount');
      expect(col).not.toHaveProperty('uniqueCount');
    }
    // No sampleRows in compact mode
    expect(table.sampleRows).toBeUndefined();
    // getSampleRows should NOT have been called
    expect(manager._mockSource.getSampleRows).not.toHaveBeenCalled();
  });

  it('includes full profile with stats, topValues, sample, and sampleRows when detail is full', async () => {
    const manager = makeMockManager();

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/tmp/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    const table = body.tables[0];
    expect(table.sampleRows).toBeDefined();
    expect(manager._mockSource.getSampleRows).toHaveBeenCalledWith('data', 5);

    const idCol = table.columns.find((c: any) => c.name === 'id');
    expect(idCol.stats).toEqual({ min: 1, max: 3, mean: 2 });
    expect(idCol.sample).toEqual([1, 2, 3]);

    const nameCol = table.columns.find((c: any) => c.name === 'name');
    expect(nameCol.topValues).toBeDefined();
    expect(nameCol.topValues).toHaveLength(2);
    expect(nameCol.sample).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('handles getSchema failure gracefully (empty tables)', async () => {
    const manager = makeMockManager({
      getSchema: vi.fn().mockResolvedValue({ ok: false, error: 'Schema error' }),
    });

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/tmp/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.tables).toEqual([]);
    expect(body.message).toContain('0 tables found');
  });

  it('handles connect failure gracefully (sampleRows empty for full detail)', async () => {
    const manager = makeMockManager({
      connect: vi.fn().mockResolvedValue({ ok: false, error: 'Connection lost' }),
    });

    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/tmp/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    const table = body.tables[0];
    // When connectedSource is null, sampleRows should be empty
    expect(table.sampleRows).toEqual([]);
  });
});


// ─── handleRemoveSource ──────────────────────────────────────────────────────

describe('handleRemoveSource', () => {
  it('removes a valid source and returns success message', async () => {
    const manager = makeMockManager({
      remove: vi.fn().mockResolvedValue({ ok: true }),
    });

    const handler = handleRemoveSource({ sourceManager: manager });
    const result = await handler({ sourceId: 'src-123' });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.message).toBe('Source "src-123" removed');
    expect(manager.remove).toHaveBeenCalledWith('src-123');
  });

  it('returns error when remove returns ok: false', async () => {
    const manager = makeMockManager({
      remove: vi.fn().mockResolvedValue({ ok: false, error: 'Source not found' }),
    });

    const handler = handleRemoveSource({ sourceManager: manager });
    const result = await handler({ sourceId: 'nonexistent' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Source not found');
  });

  it('returns error when remove throws', async () => {
    const manager = makeMockManager({
      remove: vi.fn().mockRejectedValue(new Error('Database locked')),
    });

    const handler = handleRemoveSource({ sourceManager: manager });
    const result = await handler({ sourceId: 'src-locked' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Database locked');
  });

  it('returns fallback error message when remove returns ok: false without error string', async () => {
    const manager = makeMockManager({
      remove: vi.fn().mockResolvedValue({ ok: false }),
    });

    const handler = handleRemoveSource({ sourceManager: manager });
    const result = await handler({ sourceId: 'src-x' });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Failed to remove source');
  });
});


// ─── handleDescribeSource ────────────────────────────────────────────────────

describe('handleDescribeSource', () => {
  it('returns error when table name is not found in schema', async () => {
    const manager = makeMockManager();

    const handler = handleDescribeSource({ sourceManager: manager });
    const result = await handler({
      sourceId: 'src-123',
      table: 'nonexistent_table',
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('Table "nonexistent_table" not found');
    expect(body.error).toContain('data'); // Should list available tables
  });

  it('returns compact profile without stats, topValues, or sampleRows', async () => {
    const manager = makeMockManager();

    const handler = handleDescribeSource({ sourceManager: manager });
    const result = await handler({
      sourceId: 'src-123',
      table: 'data',
      detail: 'compact',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    expect(body.name).toBe('data');
    expect(body.rowCount).toBe(3);
    for (const col of body.columns) {
      expect(col).toHaveProperty('name');
      expect(col).toHaveProperty('type');
      expect(col).not.toHaveProperty('stats');
      expect(col).not.toHaveProperty('topValues');
      expect(col).not.toHaveProperty('sample');
    }
    expect(body.sampleRows).toBeUndefined();
    expect(manager._mockSource.getSampleRows).not.toHaveBeenCalled();
  });

  it('returns all tables as array when no table arg is provided', async () => {
    const multiTableSchema = {
      ok: true,
      schema: {
        tables: [
          {
            name: 'users',
            rowCount: 10,
            columns: [
              { name: 'id', type: 'integer', nullCount: 0, uniqueCount: 10, stats: { min: 1, max: 10 }, sampleValues: [1, 2] },
            ],
          },
          {
            name: 'orders',
            rowCount: 50,
            columns: [
              { name: 'order_id', type: 'integer', nullCount: 0, uniqueCount: 50, stats: { min: 1, max: 50 }, sampleValues: [1] },
              { name: 'user_id', type: 'integer', nullCount: 0, uniqueCount: 10, stats: { min: 1, max: 10 }, sampleValues: [3] },
            ],
          },
        ],
      },
    };
    const manager = makeMockManager({
      getSchema: vi.fn().mockResolvedValue(multiTableSchema),
    });

    const handler = handleDescribeSource({ sourceManager: manager });
    // No table arg -- should return all tables as an array
    const result = await handler({
      sourceId: 'src-123',
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    // Body should be an array of table profiles
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('users');
    expect(body[1].name).toBe('orders');
    // Both should have sampleRows since detail is full
    expect(body[0].sampleRows).toBeDefined();
    expect(body[1].sampleRows).toBeDefined();
  });

  it('returns a single table object (not array) when table arg is provided', async () => {
    const manager = makeMockManager();

    const handler = handleDescribeSource({ sourceManager: manager });
    const result = await handler({
      sourceId: 'src-123',
      table: 'data',
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);

    // When a specific table is requested, body is the single profile, not an array
    expect(Array.isArray(body)).toBe(false);
    expect(body.name).toBe('data');
    expect(body.rowCount).toBe(3);
    expect(body.sampleRows).toBeDefined();
  });

  it('returns error when getSchema fails', async () => {
    const manager = makeMockManager({
      getSchema: vi.fn().mockResolvedValue({ ok: false, error: 'Source not found: src-bad' }),
    });

    const handler = handleDescribeSource({ sourceManager: manager });
    const result = await handler({
      sourceId: 'src-bad',
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Source not found: src-bad');
  });

  it('handles getSchema returning ok: false with no error message', async () => {
    const manager = makeMockManager({
      getSchema: vi.fn().mockResolvedValue({ ok: false }),
    });

    const handler = handleDescribeSource({ sourceManager: manager });
    const result = await handler({
      sourceId: 'src-unknown',
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toBe('Source not found: src-unknown');
  });
});


// ─── Sandbox path detection ────────────────────────────────────────────────

describe('isSandboxPath', () => {
  it('detects /mnt/user-data/uploads/ paths', () => {
    expect(isSandboxPath('/mnt/user-data/uploads/data.csv')).toBe(true);
  });

  it('detects /home/claude/ paths', () => {
    expect(isSandboxPath('/home/claude/data.csv')).toBe(true);
  });

  it('detects /tmp/uploads/ paths', () => {
    expect(isSandboxPath('/tmp/uploads/file.csv')).toBe(true);
  });

  it('allows normal local paths', () => {
    expect(isSandboxPath('/Users/bill/Downloads/data.csv')).toBe(false);
    expect(isSandboxPath('C:\\Users\\bill\\Downloads\\data.csv')).toBe(false);
    expect(isSandboxPath('/home/bill/data.csv')).toBe(false);
  });
});

describe('handleAddSource sandbox path rejection', () => {
  it('rejects /mnt/user-data/uploads/ paths with guidance', async () => {
    const manager = makeMockManager();
    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/mnt/user-data/uploads/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('cloud sandbox path');
    expect(body.error).toContain('real local path');
    expect(manager.add).not.toHaveBeenCalled();
  });

  it('rejects /home/claude/ paths with guidance', async () => {
    const manager = makeMockManager();
    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/home/claude/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('local filesystem');
  });

  it('rejects sandbox paths for sqlite too', async () => {
    const manager = makeMockManager();
    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'sqlite',
      config: { type: 'sqlite' as const, path: '/mnt/user-data/uploads/db.sqlite' },
      detail: 'full',
    });

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('local filesystem');
  });

  it('allows normal local paths through', async () => {
    const manager = makeMockManager();
    const handler = handleAddSource({ sourceManager: manager });
    const result = await handler({
      name: 'test',
      type: 'csv',
      config: { type: 'csv' as const, path: '/Users/bill/Downloads/data.csv' },
      detail: 'full',
    });

    expect(result.isError).toBeUndefined();
  });
});
