import { describe, it, expect } from 'vitest';
import { validateDsl, validateDslWithJoins } from '../../src/connectors/dsl-validator.js';
import type { DataTable, DataSchema } from '../../src/types.js';

const table: DataTable = {
  name: 'sales',
  rowCount: 100,
  columns: [
    { name: 'region', type: 'categorical', sampleValues: [], uniqueCount: 5, nullCount: 0, totalCount: 100 },
    { name: 'revenue', type: 'numeric', sampleValues: [], uniqueCount: 90, nullCount: 0, totalCount: 100 },
    { name: 'date', type: 'date', sampleValues: [], uniqueCount: 50, nullCount: 0, totalCount: 100 },
    { name: 'customer_id', type: 'id', sampleValues: [], uniqueCount: 95, nullCount: 0, totalCount: 100 },
  ],
};

describe('DSL Validator', () => {
  it('accepts valid query', () => {
    const result = validateDsl(table, {
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects unknown field with suggestion', () => {
    const result = validateDsl(table, {
      select: ['regon'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('regon');
    expect(result.error).toContain('region');
  });

  it('rejects sum on categorical field', () => {
    const result = validateDsl(table, {
      select: [{ field: 'region', aggregate: 'sum', as: 'total' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('sum');
    expect(result.error).toContain('region');
  });

  it('allows count on any field', () => {
    const result = validateDsl(table, {
      select: [{ field: 'region', aggregate: 'count', as: 'n' }],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts stddev on numeric field', () => {
    const result = validateDsl(table, {
      select: [{ field: 'revenue', aggregate: 'stddev', as: 'rev_std' }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects stddev on categorical field', () => {
    const result = validateDsl(table, {
      select: [{ field: 'region', aggregate: 'stddev', as: 'std' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('stddev');
    expect(result.error).toContain('region');
  });

  it('accepts percentile with valid parameter', () => {
    const result = validateDsl(table, {
      select: [{ field: 'revenue', aggregate: 'percentile', percentile: 0.95, as: 'p95' }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects percentile without parameter', () => {
    const result = validateDsl(table, {
      select: [{ field: 'revenue', aggregate: 'percentile', as: 'p95' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('percentile');
  });

  it('rejects percentile with out-of-range parameter', () => {
    const result = validateDsl(table, {
      select: [{ field: 'revenue', aggregate: 'percentile', percentile: 1.5, as: 'p150' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('0 and 1');
  });

  it('accepts having referencing aggregate alias', () => {
    const result = validateDsl(table, {
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: ['region'],
      having: [{ field: 'total', op: '>', value: 1000 }],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects having referencing non-alias field', () => {
    const result = validateDsl(table, {
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: ['region'],
      having: [{ field: 'revenue', op: '>', value: 1000 }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('revenue');
    expect(result.error).toContain('aggregate alias');
  });

  it('rejects bucket on non-date field', () => {
    const result = validateDsl(table, {
      select: ['revenue'],
      groupBy: [{ field: 'revenue', bucket: 'month' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bucket');
  });

  it('accepts orderBy referencing time-bucket alias', () => {
    const result = validateDsl(table, {
      select: [{ field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: [{ field: 'date', bucket: 'month' }],
      orderBy: [{ field: 'date_month', direction: 'asc' }],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts orderBy referencing time-bucket alias with window functions', () => {
    const result = validateDsl(table, {
      select: [
        { field: 'revenue', aggregate: 'sum', as: 'monthly_revenue' },
        { window: 'lag', field: 'monthly_revenue', offset: 1, as: 'prev_month',
          orderBy: [{ field: 'date_month', direction: 'asc' }] },
      ],
      groupBy: [{ field: 'date', bucket: 'month' }],
      orderBy: [{ field: 'date_month', direction: 'asc' }],
    });
    expect(result.ok).toBe(true);
  });
});

// ─── JOIN VALIDATION ──────────────────────────────────────────────────────────

const multiTableSchema: DataSchema = {
  tables: [
    {
      name: 'order_items',
      rowCount: 100,
      columns: [
        { name: 'order_id', type: 'id', sampleValues: [], uniqueCount: 80, nullCount: 0, totalCount: 100 },
        { name: 'product_id', type: 'id', sampleValues: [], uniqueCount: 50, nullCount: 0, totalCount: 100 },
        { name: 'seller_id', type: 'id', sampleValues: [], uniqueCount: 30, nullCount: 0, totalCount: 100 },
        { name: 'price', type: 'numeric', sampleValues: [], uniqueCount: 90, nullCount: 0, totalCount: 100 },
      ],
    },
    {
      name: 'products',
      rowCount: 50,
      columns: [
        { name: 'product_id', type: 'id', sampleValues: [], uniqueCount: 50, nullCount: 0, totalCount: 50 },
        { name: 'product_category_name', type: 'categorical', sampleValues: [], uniqueCount: 20, nullCount: 0, totalCount: 50 },
      ],
    },
    {
      name: 'orders',
      rowCount: 80,
      columns: [
        { name: 'order_id', type: 'id', sampleValues: [], uniqueCount: 80, nullCount: 0, totalCount: 80 },
        { name: 'customer_id', type: 'id', sampleValues: [], uniqueCount: 70, nullCount: 0, totalCount: 80 },
        { name: 'order_status', type: 'categorical', sampleValues: [], uniqueCount: 5, nullCount: 0, totalCount: 80 },
      ],
    },
    {
      name: 'customers',
      rowCount: 70,
      columns: [
        { name: 'customer_id', type: 'id', sampleValues: [], uniqueCount: 70, nullCount: 0, totalCount: 70 },
        { name: 'customer_state', type: 'categorical', sampleValues: [], uniqueCount: 27, nullCount: 0, totalCount: 70 },
      ],
    },
  ],
  foreignKeys: [],
  source: { id: 'test', type: 'csv', name: 'test', config: { type: 'csv', path: '/tmp' } },
};

describe('DSL Validator — joins', () => {
  it('accepts valid two-table join', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: ['products.product_category_name', { field: 'price', aggregate: 'sum', as: 'revenue' }],
      groupBy: ['products.product_category_name'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts valid three-table chain', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'orders', on: { left: 'order_id', right: 'order_id' }, type: 'inner' },
        { table: 'customers', on: { left: 'orders.customer_id', right: 'customer_id' } },
      ],
      select: ['customers.customer_state', { field: 'price', aggregate: 'sum', as: 'total' }],
      groupBy: ['customers.customer_state'],
    });
    expect(result.ok).toBe(true);
  });

  it('delegates to simple validator when no joins', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      select: ['price'],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects unknown base table', () => {
    const result = validateDslWithJoins(multiTableSchema, 'nonexistent', {
      select: ['price'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent');
    expect(result.error).toContain('not found');
  });

  it('rejects unknown table in join', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'nonexistent', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: ['price'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent');
    expect(result.error).toContain('not found');
  });

  it('rejects unknown field in on.left', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'bogus_id', right: 'product_id' } },
      ],
      select: ['price'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bogus_id');
  });

  it('rejects unknown field in on.right', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'bogus_id' } },
      ],
      select: ['price'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bogus_id');
  });

  it('rejects dot-notation select referencing non-joined table', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: ['customers.customer_state'], // customers not joined
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('customers');
  });

  it('rejects dot-notation with unknown column in joined table', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: ['products.nonexistent_col'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent_col');
  });

  it('rejects ambiguous field without table prefix', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'orders', on: { left: 'order_id', right: 'order_id' } },
      ],
      select: ['order_id'], // ambiguous: exists in both order_items and orders
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ambiguous');
  });

  it('accepts unambiguous field without table prefix', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: ['price'], // only in order_items
    });
    expect(result.ok).toBe(true);
  });

  it('validates orderBy aliases work with joins', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: [{ field: 'price', aggregate: 'sum', as: 'revenue' }],
      orderBy: [{ field: 'revenue', direction: 'desc' }],
    });
    expect(result.ok).toBe(true);
  });

  it('validates filter with dot-notation in join context', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'orders', on: { left: 'order_id', right: 'order_id' } },
      ],
      select: ['price'],
      filter: [{ field: 'orders.order_status', op: '=', value: 'delivered' }],
    });
    expect(result.ok).toBe(true);
  });
});

// ─── WINDOW FUNCTION VALIDATION ─────────────────────────────────────────────

describe('DSL Validator — window functions', () => {
  it('accepts valid window function referencing aggregate alias', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'rank', as: 'rnk', orderBy: [{ field: 'total', direction: 'desc' }] },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts window function referencing pass-through field', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        'revenue',
        { window: 'row_number', as: 'rn', orderBy: [{ field: 'revenue', direction: 'desc' }] },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects lag without field', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'lag', as: 'prev', orderBy: [{ field: 'total', direction: 'asc' }] },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('lag');
    expect(result.error).toContain('field');
  });

  it('rejects rank without orderBy', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'rank', as: 'rnk' },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('rank');
    expect(result.error).toContain('orderBy');
  });

  it('rejects window field referencing non-existent base column', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'lag', field: 'nonexistent', as: 'prev', orderBy: [{ field: 'total', direction: 'asc' }] },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent');
    expect(result.error).toContain('base query output');
  });

  it('rejects window orderBy referencing non-existent base column', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'rank', as: 'rnk', orderBy: [{ field: 'bogus', direction: 'desc' }] },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('bogus');
  });

  it('rejects window partitionBy referencing non-existent base column', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'rank', as: 'rnk', partitionBy: ['nonexistent'], orderBy: [{ field: 'total', direction: 'desc' }] },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nonexistent');
  });

  it('accepts pct_of_total without orderBy', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'pct_of_total', field: 'total', as: 'pct' },
      ],
      groupBy: ['region'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts window referencing time-bucket alias', () => {
    const result = validateDsl(table, {
      select: [
        { field: 'revenue', aggregate: 'sum', as: 'monthly_revenue' },
        { window: 'lag', field: 'monthly_revenue', as: 'prev', orderBy: [{ field: 'date_month', direction: 'asc' }] },
      ],
      groupBy: [{ field: 'date', bucket: 'month' }],
    });
    expect(result.ok).toBe(true);
  });

  it('allows query orderBy to reference window alias', () => {
    const result = validateDsl(table, {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { window: 'rank', as: 'rnk', orderBy: [{ field: 'total', direction: 'desc' }] },
      ],
      groupBy: ['region'],
      orderBy: [{ field: 'rnk', direction: 'asc' }],
    });
    expect(result.ok).toBe(true);
  });

  it('validates window functions in join context', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: [
        'products.product_category_name',
        { field: 'price', aggregate: 'sum', as: 'revenue' },
        { window: 'rank', as: 'rnk', orderBy: [{ field: 'revenue', direction: 'desc' }] },
      ],
      groupBy: ['products.product_category_name'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts partitionBy with dot-notation on joined column', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: [
        'products.product_category_name',
        { field: 'price', aggregate: 'sum', as: 'revenue' },
        { window: 'rank', as: 'cat_rank', partitionBy: ['products.product_category_name'], orderBy: [{ field: 'revenue', direction: 'desc' }] },
      ],
      groupBy: ['products.product_category_name'],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts partitionBy with unqualified name on joined column', () => {
    const result = validateDslWithJoins(multiTableSchema, 'order_items', {
      join: [
        { table: 'products', on: { left: 'product_id', right: 'product_id' } },
      ],
      select: [
        'products.product_category_name',
        { field: 'price', aggregate: 'sum', as: 'revenue' },
        { window: 'rank', as: 'cat_rank', partitionBy: ['product_category_name'], orderBy: [{ field: 'revenue', direction: 'desc' }] },
      ],
      groupBy: ['products.product_category_name'],
    });
    expect(result.ok).toBe(true);
  });
});
