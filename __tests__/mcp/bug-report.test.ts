import { describe, it, expect, beforeEach } from 'vitest';
import {
  OperationLog,
  extractDslStructure,
  operationLog,
} from '../../src/mcp/tools/operation-log.js';
import {
  anonymizeColumns,
  sanitizeSpecConfig,
  sanitizeError,
  handleReportBug,
} from '../../src/mcp/tools/bug-report.js';
import { specStore } from '../../src/mcp/spec-store.js';
import type { DataColumn } from '../../src/types.js';

function col(name: string, type: DataColumn['type']): DataColumn {
  return { name, type, sampleValues: [], uniqueCount: 0, nullCount: 0, totalCount: 0 };
}

// ─── OperationLog ───────────────────────────────────────────────────────────

describe('OperationLog', () => {
  let log: OperationLog;

  beforeEach(() => {
    log = new OperationLog();
  });

  function entry(toolName: string, success = true) {
    return {
      toolName,
      timestamp: Date.now(),
      durationMs: 42,
      success,
      meta: {},
    };
  }

  it('stores and retrieves entries', () => {
    log.log(entry('visualize'));
    log.log(entry('refine_visualization'));
    expect(log.size).toBe(2);
    expect(log.getLast()!.toolName).toBe('refine_visualization');
  });

  it('getAll returns newest-first', () => {
    log.log(entry('a'));
    log.log(entry('b'));
    log.log(entry('c'));
    const all = log.getAll();
    expect(all.map(e => e.toolName)).toEqual(['c', 'b', 'a']);
  });

  it('ring buffer evicts oldest when full', () => {
    for (let i = 0; i < 15; i++) {
      log.log(entry(`tool-${i}`));
    }
    expect(log.size).toBe(10);
    const all = log.getAll();
    expect(all[all.length - 1].toolName).toBe('tool-5');
    expect(all[0].toolName).toBe('tool-14');
  });

  it('clear removes all entries', () => {
    log.log(entry('a'));
    log.log(entry('b'));
    log.clear();
    expect(log.size).toBe(0);
    expect(log.getAll()).toEqual([]);
    expect(log.getLast()).toBeUndefined();
  });
});

// ─── extractDslStructure ────────────────────────────────────────────────────

describe('extractDslStructure', () => {
  it('extracts clause presence', () => {
    const result = extractDslStructure({
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: ['region'],
      filter: [{ field: 'year', op: '=', value: 2024 }],
      orderBy: [{ field: 'total', direction: 'desc' }],
      limit: 10,
    });
    expect(result.hasGroupBy).toBe(true);
    expect(result.hasFilter).toBe(true);
    expect(result.hasOrderBy).toBe(true);
    expect(result.hasLimit).toBe(true);
    expect(result.hasJoin).toBe(false);
    expect(result.hasHaving).toBe(false);
    expect(result.aggregates).toEqual(['sum']);
    expect(result.windows).toEqual([]);
  });

  it('extracts window functions', () => {
    const result = extractDslStructure({
      select: [
        'month',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'lag', field: 'total', as: 'prev', orderBy: [{ field: 'month', direction: 'asc' }] },
      ],
      groupBy: ['month'],
    });
    expect(result.aggregates).toEqual(['sum']);
    expect(result.windows).toEqual(['lag']);
  });

  it('deduplicates aggregates', () => {
    const result = extractDslStructure({
      select: [
        { field: 'a', aggregate: 'sum', as: 'x' },
        { field: 'b', aggregate: 'sum', as: 'y' },
        { field: 'c', aggregate: 'avg', as: 'z' },
      ],
    });
    expect(result.aggregates).toEqual(['sum', 'avg']);
  });

  it('handles null/undefined input', () => {
    const result = extractDslStructure(null);
    expect(result.hasJoin).toBe(false);
    expect(result.aggregates).toEqual([]);
  });

  it('detects joins', () => {
    const result = extractDslStructure({
      join: [{ table: 'orders', on: { left: 'id', right: 'customer_id' } }],
      select: ['name'],
    });
    expect(result.hasJoin).toBe(true);
  });
});

// ─── Sanitization ───────────────────────────────────────────────────────────

describe('anonymizeColumns', () => {
  const columns = [
    { name: 'customer_name', type: 'categorical' },
    { name: 'revenue', type: 'numeric' },
    { name: 'order_date', type: 'date' },
  ];

  it('anonymizes by default', () => {
    const result = anonymizeColumns(columns, false);
    expect(result).toEqual([
      { name: 'col_0', type: 'categorical' },
      { name: 'col_1', type: 'numeric' },
      { name: 'col_2', type: 'date' },
    ]);
  });

  it('includes real names when opted in', () => {
    const result = anonymizeColumns(columns, true);
    expect(result[0].name).toBe('customer_name');
    expect(result[1].name).toBe('revenue');
  });
});

describe('sanitizeSpecConfig', () => {
  it('includes safe primitive values', () => {
    const result = sanitizeSpecConfig({
      orientation: 'horizontal',
      showLegend: true,
      maxBars: 10,
    });
    expect(result).toEqual({
      orientation: 'horizontal',
      showLegend: 'true',
      maxBars: '10',
    });
  });

  it('strips internal keys and describes objects', () => {
    const result = sanitizeSpecConfig({
      _pendingRefinement: 'something',
      subtitle: 'My chart',
      nested: { deep: true },
    });
    expect(result._pendingRefinement).toBeUndefined();
    expect(result.subtitle).toBe('My chart');
    expect(result.nested).toBe('object');
  });

  it('handles null values', () => {
    const result = sanitizeSpecConfig({ val: null });
    expect(result.val).toBe('null');
  });
});

describe('sanitizeError', () => {
  it('redacts file paths', () => {
    const result = sanitizeError('Cannot find /Users/bill/data/secret.csv');
    expect(result).toBe('Cannot find <path>');
    expect(result).not.toContain('/Users');
  });

  it('redacts connection strings', () => {
    const result = sanitizeError('Connection failed: postgres://user:pass@host:5432/db');
    expect(result).toBe('Connection failed: <connection-string>');
  });

  it('redacts email addresses', () => {
    const result = sanitizeError('Invalid user: admin@example.com');
    expect(result).toBe('Invalid user: <email>');
  });
});

// ─── Report Assembly ────────────────────────────────────────────────────────

describe('handleReportBug', () => {
  const mockSourceManager = {
    list: () => [
      { id: 'src-1', name: 'test', type: 'csv' },
      { id: 'src-2', name: 'db', type: 'sqlite' },
    ],
    isConnected: () => true,
  };

  beforeEach(() => {
    specStore.clear();
    operationLog.clear();
  });

  it('generates a report with all sections', async () => {
    const handler = handleReportBug({
      sourceManager: mockSourceManager as any,
      serverStartTime: Date.now() - 300000,
    });

    const result = await handler({
      description: 'The bar chart renders upside down',
    });

    const text = result.content[0].text;
    expect(text).toContain('## Description');
    expect(text).toContain('The bar chart renders upside down');
    expect(text).toContain('## Environment');
    expect(text).toContain('Dolex');
    expect(text).toContain('Node.js');
    expect(text).toContain('## Recent Operations');
    expect(text).toContain('## Server State');
    expect(text).toContain('csv: 1');
    expect(text).toContain('sqlite: 1');
  });

  it('includes visualization context when specId provided', async () => {
    const specId = specStore.save(
      {
        pattern: 'bar',
        title: 'Test',
        data: [{ region: 'North', sales: 100 }, { region: 'South', sales: 200 }],
        encoding: {
          x: { field: 'region', type: 'nominal' },
          y: { field: 'sales', type: 'quantitative' },
        },
        config: { orientation: 'vertical', subtitle: 'Sales by Region' },
      } as any,
      [
        col('region', 'categorical'),
        col('sales', 'numeric'),
      ],
    );

    const handler = handleReportBug({
      sourceManager: mockSourceManager as any,
      serverStartTime: Date.now(),
    });

    const result = await handler({ description: 'Bug', specId });
    const text = result.content[0].text;

    expect(text).toContain('## Visualization Context');
    expect(text).toContain('bar');
    expect(text).toContain('col_0');
    expect(text).toContain('col_1');
    expect(text).not.toContain('region');
    expect(text).not.toContain('sales');
  });

  it('includes real field names when includeFieldNames is true', async () => {
    const specId = specStore.save(
      {
        pattern: 'bar',
        title: 'Test',
        data: [{ region: 'North', sales: 100 }],
        encoding: {
          x: { field: 'region', type: 'nominal' },
          y: { field: 'sales', type: 'quantitative' },
        },
        config: {},
      } as any,
      [
        col('region', 'categorical'),
        col('sales', 'numeric'),
      ],
    );

    const handler = handleReportBug({
      sourceManager: mockSourceManager as any,
      serverStartTime: Date.now(),
    });

    const result = await handler({ description: 'Bug', specId, includeFieldNames: true });
    const text = result.content[0].text;

    expect(text).toContain('region');
    expect(text).toContain('sales');
  });

  it('includes recent operations in the report', async () => {
    operationLog.log({
      toolName: 'visualize',
      timestamp: Date.now(),
      durationMs: 150,
      success: true,
      meta: {
        pattern: 'bar',
        dataShape: { rowCount: 10, columnCount: 3, columns: [] },
      },
    });
    operationLog.log({
      toolName: 'query_source',
      timestamp: Date.now(),
      durationMs: 50,
      success: false,
      meta: { error: 'table not found' },
    });

    const handler = handleReportBug({
      sourceManager: mockSourceManager as any,
      serverStartTime: Date.now(),
    });

    const result = await handler({ description: 'Something broke' });
    const text = result.content[0].text;

    expect(text).toContain('visualize');
    expect(text).toContain('query_source');
    expect(text).toContain('bar');
    expect(text).toContain('10r x 3c');
    expect(text).toContain('error');
  });

  it('never includes data values', async () => {
    const specId = specStore.save(
      {
        pattern: 'bar',
        title: 'Secret Data',
        data: [
          { name: 'CONFIDENTIAL_CUSTOMER', revenue: 999999 },
          { name: 'SECRET_CLIENT', revenue: 888888 },
        ],
        encoding: { x: { field: 'name' }, y: { field: 'revenue' } },
        config: {},
      } as any,
      [
        col('name', 'categorical'),
        col('revenue', 'numeric'),
      ],
    );

    const handler = handleReportBug({
      sourceManager: mockSourceManager as any,
      serverStartTime: Date.now(),
    });

    const result = await handler({ description: 'Bug', specId });
    const text = result.content[0].text;

    expect(text).not.toContain('CONFIDENTIAL_CUSTOMER');
    expect(text).not.toContain('SECRET_CLIENT');
    expect(text).not.toContain('999999');
    expect(text).not.toContain('888888');
  });
});
