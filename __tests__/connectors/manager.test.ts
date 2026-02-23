import { describe, it, expect, beforeEach } from 'vitest';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';

const FIXTURES = path.resolve(__dirname, '../fixtures');

// ── In-memory registry tests (no persistence, no actual connections) ─────────

describe('SourceManager (in-memory registry)', () => {
  let manager: SourceManager;

  beforeEach(() => {
    manager = new SourceManager();
  });

  it('constructor creates an empty manager', () => {
    expect(manager.list()).toHaveLength(0);
  });

  it('add() with CSV config returns ok and entry with stable ID', async () => {
    const result = await manager.add('test-csv', {
      type: 'csv',
      path: FIXTURES,
    });

    expect(result.ok).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.entry!.id).toBeTruthy();
    expect(result.entry!.name).toBe('test-csv');
    expect(result.entry!.type).toBe('csv');

    // ID should be stable (deterministic from name)
    const result2 = await manager.add('test-csv-2', {
      type: 'csv',
      path: FIXTURES,
    });
    expect(result2.ok).toBe(true);
    // Different names should produce different IDs
    expect(result2.entry!.id).not.toBe(result.entry!.id);
  });

  it('add() with duplicate name returns error', async () => {
    const first = await manager.add('my-source', { type: 'csv', path: FIXTURES });
    expect(first.ok).toBe(true);

    const second = await manager.add('my-source', { type: 'csv', path: FIXTURES });
    expect(second.ok).toBe(false);
    expect(second.error).toBeDefined();
    expect(second.error).toContain('already exists');
  });

  it('list() returns all added sources', async () => {
    await manager.add('source-a', { type: 'csv', path: FIXTURES });
    await manager.add('source-b', { type: 'csv', path: FIXTURES });

    const list = manager.list();
    expect(list).toHaveLength(2);
    const names = list.map((e) => e.name);
    expect(names).toContain('source-a');
    expect(names).toContain('source-b');
  });

  it('get() by ID returns the entry', async () => {
    const addResult = await manager.add('by-id-test', { type: 'csv', path: FIXTURES });
    const id = addResult.entry!.id;

    const entry = manager.get(id);
    expect(entry).toBeDefined();
    expect(entry!.id).toBe(id);
    expect(entry!.name).toBe('by-id-test');
  });

  it('get() by name (case-insensitive) returns the entry', async () => {
    await manager.add('My-Source', { type: 'csv', path: FIXTURES });

    const entry = manager.get('my-source');
    expect(entry).toBeDefined();
    expect(entry!.name).toBe('My-Source');
  });

  it('remove() removes the entry', async () => {
    const addResult = await manager.add('removable', { type: 'csv', path: FIXTURES });
    const id = addResult.entry!.id;

    expect(manager.list()).toHaveLength(1);
    const removeResult = await manager.remove(id);
    expect(removeResult.ok).toBe(true);
    expect(manager.list()).toHaveLength(0);
  });

  it('remove() non-existent returns error', async () => {
    const result = await manager.remove('does-not-exist');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  it('after add + remove, list() is empty', async () => {
    const addResult = await manager.add('temp', { type: 'csv', path: FIXTURES });

    expect(manager.list()).toHaveLength(1);
    await manager.remove(addResult.entry!.id);
    expect(manager.list()).toHaveLength(0);
  });
});

// ── CSV connector integration (uses synthetic fixture CSV) ───────────────────

describe('SourceManager CSV integration', () => {
  it('should add a CSV source and retrieve its schema with tables', async () => {
    const manager = new SourceManager();

    const addResult = await manager.add('sales', { type: 'csv', path: FIXTURES });
    expect(addResult.ok).toBe(true);
    expect(addResult.entry).toBeDefined();

    // Get schema — this triggers connection + schema introspection
    const schemaResult = await manager.getSchema('sales');
    expect(schemaResult.ok).toBe(true);
    expect(schemaResult.schema).toBeDefined();
    expect(schemaResult.schema!.tables.length).toBeGreaterThan(0);

    // The fixtures directory has sales.csv → should produce a 'sales' table
    const tableNames = schemaResult.schema!.tables.map((t) => t.name);
    expect(tableNames).toContain('sales');

    // Table should have columns
    const salesTable = schemaResult.schema!.tables.find((t) => t.name === 'sales');
    expect(salesTable).toBeDefined();
    expect(salesTable!.columns.length).toBe(5);
    expect(salesTable!.rowCount).toBe(20);

    // Clean up
    await manager.closeAll();
  });
});
