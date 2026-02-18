import { describe, it, expect } from 'vitest';
import { SourceManager } from '../../src/connectors/manager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('SourceManager DSL Query Execution', () => {
  let manager: SourceManager;
  let tmpDir: string;

  function setupCsv() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-exec-'));
    const csvPath = path.join(tmpDir, 'sales.csv');
    const rows = [
      'date,region,revenue,product',
      '2024-01-15,North,100,Electronics',
      '2024-02-20,North,200,Clothing',
      '2024-03-10,South,150,Electronics',
      '2024-04-05,South,300,Electronics',
      '2024-05-12,East,250,Clothing',
      '2024-06-01,East,175,Home',
      '2024-07-15,West,400,Electronics',
      '2024-08-20,West,50,Clothing',
      '2024-09-10,North,325,Home',
      '2024-10-05,South,275,Clothing',
    ];
    fs.writeFileSync(csvPath, rows.join('\n'));
    return csvPath;
  }

  it('simple select returns rows', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('sales', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('sales', 'sales', {
      select: ['region', 'revenue'],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(10);
    expect(result.columns).toContain('region');
    expect(result.columns).toContain('revenue');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('aggregation with groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('sales', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('sales', 'sales', {
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total_revenue' }],
      groupBy: ['region'],
      orderBy: [{ field: 'total_revenue', direction: 'desc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(4);
    // All 4 regions present, top row should be highest total
    const topTotal = result.rows![0].total_revenue as number;
    expect(topTotal).toBeGreaterThanOrEqual(result.rows![1].total_revenue as number);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('filter narrows results', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('sales', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('sales', 'sales', {
      select: ['region', 'revenue'],
      filter: [{ field: 'revenue', op: '>', value: 200 }],
    });

    expect(result.ok).toBe(true);
    // Only rows with revenue > 200: 300, 250, 400, 325, 275 = 5 rows
    expect(result.rows!.length).toBe(5);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns error for non-existent source', async () => {
    manager = new SourceManager();
    const result = await manager.queryDsl('nope', 'sales', {
      select: ['region'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('validates field names with fuzzy suggestions', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('sales', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('sales', 'sales', {
      select: ['regon'], // typo
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('regon');
    expect(result.error).toContain('region');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── PERCENTILE AGGREGATE EXECUTION ──────────────────────────────────────────

describe('Percentile aggregates on CSV/SQLite', () => {
  let manager: SourceManager;
  let tmpDir: string;

  function setupCsv() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-pct-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    const rows = [
      'category,value',
      'A,10',
      'A,20',
      'A,30',
      'A,40',
      'A,50',
      'B,100',
      'B,200',
      'B,300',
      'B,400',
      'B,500',
    ];
    fs.writeFileSync(csvPath, rows.join('\n'));
    return csvPath;
  }

  it('median without groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        { field: 'value', aggregate: 'median', as: 'median_value' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(1);
    // [10,20,30,40,50,100,200,300,400,500] → median = 75
    expect(result.rows![0].median_value).toBeCloseTo(75, 1);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('median with groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        'category',
        { field: 'value', aggregate: 'median', as: 'median_value' },
      ],
      groupBy: ['category'],
      orderBy: [{ field: 'category', direction: 'asc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(2);
    // A: [10,20,30,40,50] → median = 30
    expect(result.rows![0].category).toBe('A');
    expect(result.rows![0].median_value).toBe(30);
    // B: [100,200,300,400,500] → median = 300
    expect(result.rows![1].category).toBe('B');
    expect(result.rows![1].median_value).toBe(300);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('p25 and p75 with groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        'category',
        { field: 'value', aggregate: 'p25', as: 'p25_value' },
        { field: 'value', aggregate: 'p75', as: 'p75_value' },
      ],
      groupBy: ['category'],
      orderBy: [{ field: 'category', direction: 'asc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(2);
    // A: [10,20,30,40,50] → p25=20, p75=40
    expect(result.rows![0].p25_value).toBe(20);
    expect(result.rows![0].p75_value).toBe(40);
    // B: [100,200,300,400,500] → p25=200, p75=400
    expect(result.rows![1].p25_value).toBe(200);
    expect(result.rows![1].p75_value).toBe(400);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('mixed percentile and non-percentile aggregates', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        'category',
        { field: 'value', aggregate: 'sum', as: 'total' },
        { field: 'value', aggregate: 'avg', as: 'average' },
        { field: 'value', aggregate: 'median', as: 'median' },
        { field: 'value', aggregate: 'count', as: 'n' },
      ],
      groupBy: ['category'],
      orderBy: [{ field: 'category', direction: 'asc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(2);
    // A: sum=150, avg=30, median=30, count=5
    expect(result.rows![0].total).toBe(150);
    expect(result.rows![0].average).toBe(30);
    expect(result.rows![0].median).toBe(30);
    expect(result.rows![0].n).toBe(5);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('orderBy on percentile aggregate field', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        'category',
        { field: 'value', aggregate: 'median', as: 'median_value' },
      ],
      groupBy: ['category'],
      orderBy: [{ field: 'median_value', direction: 'desc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(2);
    // B (median=300) before A (median=30)
    expect(result.rows![0].category).toBe('B');
    expect(result.rows![1].category).toBe('A');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── STDDEV AGGREGATE EXECUTION ──────────────────────────────────────────────

describe('Stddev aggregate on CSV/SQLite', () => {
  let manager: SourceManager;
  let tmpDir: string;

  function setupCsv() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-std-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    const rows = [
      'category,value',
      'A,10',
      'A,20',
      'A,30',
      'A,40',
      'A,50',
      'B,100',
      'B,100',
      'B,100',
      'B,100',
      'B,100',
    ];
    fs.writeFileSync(csvPath, rows.join('\n'));
    return csvPath;
  }

  it('stddev without groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        { field: 'value', aggregate: 'stddev', as: 'value_stddev' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(1);
    expect(result.rows![0].value_stddev).toBeGreaterThan(0);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('stddev with groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        'category',
        { field: 'value', aggregate: 'stddev', as: 'value_stddev' },
      ],
      groupBy: ['category'],
      orderBy: [{ field: 'category', direction: 'asc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(2);
    // A: [10,20,30,40,50] → mean=30, pop stddev = sqrt(200) ≈ 14.14
    expect(result.rows![0].category).toBe('A');
    expect(result.rows![0].value_stddev).toBeCloseTo(14.14, 1);
    // B: all 100 → stddev = 0
    expect(result.rows![1].category).toBe('B');
    expect(result.rows![1].value_stddev).toBe(0);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── ARBITRARY PERCENTILE EXECUTION ─────────────────────────────────────────

describe('Arbitrary percentile on CSV/SQLite', () => {
  let manager: SourceManager;
  let tmpDir: string;

  function setupCsv() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-arb-pct-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    // 100 rows: values 1..100
    const header = 'value';
    const rows = Array.from({ length: 100 }, (_, i) => String(i + 1));
    fs.writeFileSync(csvPath, [header, ...rows].join('\n'));
    return csvPath;
  }

  it('p90, p95, p99 without groupBy', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: [
        { field: 'value', aggregate: 'percentile', percentile: 0.9, as: 'p90' },
        { field: 'value', aggregate: 'percentile', percentile: 0.95, as: 'p95' },
        { field: 'value', aggregate: 'percentile', percentile: 0.99, as: 'p99' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(1);
    // For 1..100: p90 ≈ 90.1, p95 ≈ 95.05, p99 ≈ 99.01
    expect(result.rows![0].p90).toBeCloseTo(90.1, 0);
    expect(result.rows![0].p95).toBeCloseTo(95.05, 0);
    expect(result.rows![0].p99).toBeCloseTo(99.01, 0);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── HAVING CLAUSE EXECUTION ────────────────────────────────────────────────

describe('Having clause on CSV/SQLite', () => {
  let manager: SourceManager;
  let tmpDir: string;

  function setupCsv() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-having-'));
    const csvPath = path.join(tmpDir, 'sales.csv');
    const rows = [
      'region,revenue',
      'North,100',
      'North,200',
      'North,300',
      'South,50',
      'South,25',
      'East,500',
      'East,600',
      'East,700',
      'West,10',
    ];
    fs.writeFileSync(csvPath, rows.join('\n'));
    return csvPath;
  }

  it('having filters aggregated rows (SQL path)', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('sales', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('sales', 'sales', {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
      ],
      groupBy: ['region'],
      having: [{ field: 'total', op: '>', value: 100 }],
      orderBy: [{ field: 'total', direction: 'desc' }],
    });

    expect(result.ok).toBe(true);
    // East=1800, North=600 pass; South=75, West=10 filtered out
    expect(result.rows!.length).toBe(2);
    expect(result.rows![0].region).toBe('East');
    expect(result.rows![1].region).toBe('North');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('having with JS aggregation path (percentile + having)', async () => {
    const csvPath = setupCsv();
    manager = new SourceManager();
    await manager.add('sales', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('sales', 'sales', {
      select: [
        'region',
        { field: 'revenue', aggregate: 'median', as: 'median_rev' },
      ],
      groupBy: ['region'],
      having: [{ field: 'median_rev', op: '>=', value: 200 }],
      orderBy: [{ field: 'median_rev', direction: 'desc' }],
    });

    expect(result.ok).toBe(true);
    // East: median of [500,600,700]=600, North: median of [100,200,300]=200 → both pass
    // South: median of [25,50]=37.5, West: median of [10]=10 → filtered out
    expect(result.rows!.length).toBe(2);
    expect(result.rows![0].region).toBe('East');
    expect(result.rows![1].region).toBe('North');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── JOIN EXECUTION ──────────────────────────────────────────────────────────

describe('SourceManager DSL joins', () => {
  let manager: SourceManager;
  let tmpDir: string;

  function setupMultiTableCsv() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-join-'));

    fs.writeFileSync(path.join(tmpDir, 'order_items.csv'), [
      'order_id,product_id,price',
      '1,101,50',
      '2,102,75',
      '3,101,50',
      '4,103,100',
      '5,102,75',
    ].join('\n'));

    fs.writeFileSync(path.join(tmpDir, 'products.csv'), [
      'product_id,product_category_name',
      '101,Electronics',
      '102,Clothing',
      '103,Home',
    ].join('\n'));

    fs.writeFileSync(path.join(tmpDir, 'orders.csv'), [
      'order_id,customer_id,order_status',
      '1,201,delivered',
      '2,202,delivered',
      '3,201,shipped',
      '4,203,delivered',
      '5,202,cancelled',
    ].join('\n'));

    fs.writeFileSync(path.join(tmpDir, 'customers.csv'), [
      'customer_id,customer_state',
      '201,SP',
      '202,RJ',
      '203,MG',
    ].join('\n'));

    return tmpDir;
  }

  it('two-table join: revenue by category', async () => {
    const dir = setupMultiTableCsv();
    manager = new SourceManager();
    await manager.add('ecom', { type: 'csv', path: dir });

    const result = await manager.queryDsl('ecom', 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: [
        'products.product_category_name',
        { field: 'price', aggregate: 'sum', as: 'revenue' },
      ],
      groupBy: ['products.product_category_name'],
      orderBy: [{ field: 'revenue', direction: 'desc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(3); // Electronics, Clothing, Home
    // Clothing: 75+75=150, Electronics: 50+50=100, Home: 100
    expect(result.rows![0].products_product_category_name).toBe('Clothing');
    expect(result.rows![0].revenue).toBe(150);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('three-table chain: revenue by customer state', async () => {
    const dir = setupMultiTableCsv();
    manager = new SourceManager();
    await manager.add('ecom', { type: 'csv', path: dir });

    const result = await manager.queryDsl('ecom', 'order_items', {
      join: [
        { table: 'orders', on: { left: 'order_id', right: 'order_id' }, type: 'inner' },
        { table: 'customers', on: { left: 'orders.customer_id', right: 'customer_id' } },
      ],
      select: [
        'customers.customer_state',
        { field: 'price', aggregate: 'sum', as: 'revenue' },
      ],
      groupBy: ['customers.customer_state'],
      orderBy: [{ field: 'revenue', direction: 'desc' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(3); // SP, RJ, MG
    // RJ: orders 2+5 → 75+75=150, SP: orders 1+3 → 50+50=100, MG: order 4 → 100
    expect(result.rows![0].customers_customer_state).toBe('RJ');
    expect(result.rows![0].revenue).toBe(150);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('join with filter on joined table', async () => {
    const dir = setupMultiTableCsv();
    manager = new SourceManager();
    await manager.add('ecom', { type: 'csv', path: dir });

    const result = await manager.queryDsl('ecom', 'order_items', {
      join: [
        { table: 'orders', on: { left: 'order_id', right: 'order_id' } },
      ],
      select: [
        { field: 'price', aggregate: 'sum', as: 'revenue' },
      ],
      filter: [{ field: 'orders.order_status', op: '=', value: 'delivered' }],
    });

    expect(result.ok).toBe(true);
    // Delivered orders: 1,2,4 → prices: 50,75,100 = 225
    expect(result.rows![0].revenue).toBe(225);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns error for unknown join table', async () => {
    const dir = setupMultiTableCsv();
    manager = new SourceManager();
    await manager.add('ecom', { type: 'csv', path: dir });

    const result = await manager.queryDsl('ecom', 'order_items', {
      join: [
        { table: 'nonexistent', on: { left: 'order_id', right: 'order_id' } },
      ],
      select: ['price'],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent');
    expect(result.error).toContain('not found');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('same-name columns from joined tables both appear in results', async () => {
    const dir = setupMultiTableCsv();

    fs.writeFileSync(path.join(dir, 'regions.csv'), [
      'product_id,nationality',
      '101,Japan',
      '102,Germany',
      '103,USA',
    ].join('\n'));

    fs.writeFileSync(path.join(dir, 'suppliers.csv'), [
      'product_id,nationality',
      '101,China',
      '102,Italy',
      '103,Mexico',
    ].join('\n'));

    manager = new SourceManager();
    await manager.add('ecom', { type: 'csv', path: dir });

    const result = await manager.queryDsl('ecom', 'regions', {
      join: [
        { table: 'suppliers', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: ['regions.nationality', 'suppliers.nationality'],
    });

    expect(result.ok).toBe(true);
    expect(result.columns).toContain('regions_nationality');
    expect(result.columns).toContain('suppliers_nationality');
    expect(result.rows![0].regions_nationality).toBeDefined();
    expect(result.rows![0].suppliers_nationality).toBeDefined();
    expect(result.rows![0].regions_nationality).not.toBe(result.rows![0].suppliers_nationality);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});

// ─── CSV NULL SENTINEL & NUMERIC COERCION ────────────────────────────────────

describe('CSV null sentinel and numeric coercion', () => {
  let manager: SourceManager;
  let tmpDir: string;

  it('\\N values are normalized to null', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-null-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, [
      'name,score,grade',
      'Alice,95,A',
      'Bob,\\N,B',
      'Carol,80,\\N',
      'Dave,\\N,\\N',
    ].join('\n'));

    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: ['name', 'score', 'grade'],
      filter: [{ field: 'score', op: 'is_null' }],
    });

    expect(result.ok).toBe(true);
    expect(result.rows!.length).toBe(2);
    const names = result.rows!.map(r => r.name).sort();
    expect(names).toEqual(['Bob', 'Dave']);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('numeric columns return as JS numbers, not strings', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-coerce-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, [
      'name,score,rating',
      'Alice,95,4.5',
      'Bob,80,3.8',
      'Carol,70,4.2',
    ].join('\n'));

    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: ['name', 'score', 'rating'],
    });

    expect(result.ok).toBe(true);
    expect(typeof result.rows![0].score).toBe('number');
    expect(typeof result.rows![0].rating).toBe('number');
    expect(result.rows![0].score).toBe(95);
    expect(result.rows![0].rating).toBe(4.5);
    expect(typeof result.rows![0].name).toBe('string');

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('null values in numeric columns stay null after coercion', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsl-null-num-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, [
      'name,score',
      'Alice,95',
      'Bob,\\N',
      'Carol,80',
    ].join('\n'));

    manager = new SourceManager();
    await manager.add('test', { type: 'csv', path: csvPath });

    const result = await manager.queryDsl('test', 'data', {
      select: ['name', 'score'],
    });

    expect(result.ok).toBe(true);
    const bob = result.rows!.find(r => r.name === 'Bob');
    expect(bob!.score).toBeNull();
    const alice = result.rows!.find(r => r.name === 'Alice');
    expect(typeof alice!.score).toBe('number');
    expect(alice!.score).toBe(95);

    await manager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});
