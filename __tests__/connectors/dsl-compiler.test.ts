import { describe, it, expect } from 'vitest';
import { compileDsl, hasWindowFunctions } from '../../src/connectors/dsl-compiler.js';

describe('DSL-to-SQL Compiler', () => {
  const table = 'sales';

  it('simple select without aggregation', () => {
    const sql = compileDsl(table, {
      select: ['region', 'revenue'],
    });
    expect(sql).toContain('SELECT "region", "revenue"');
    expect(sql).toContain(`FROM "${table}"`);
  });

  it('select with aggregation and groupBy', () => {
    const sql = compileDsl(table, {
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total_revenue' }],
      groupBy: ['region'],
    });
    expect(sql).toContain('SUM(CAST("revenue" AS REAL)) AS "total_revenue"');
    expect(sql).toContain('GROUP BY "region"');
  });

  it('count_distinct aggregate', () => {
    const sql = compileDsl(table, {
      select: [{ field: 'customer_id', aggregate: 'count_distinct', as: 'unique_customers' }],
    });
    expect(sql).toContain('COUNT(DISTINCT "customer_id")');
    expect(sql).toContain('AS "unique_customers"');
  });

  it('filter with comparison operators', () => {
    const sql = compileDsl(table, {
      select: ['region', 'revenue'],
      filter: [
        { field: 'revenue', op: '>', value: 100 },
        { field: 'region', op: '!=', value: 'Other' },
      ],
    });
    expect(sql).toContain('WHERE');
    expect(sql).toContain('CAST("revenue" AS REAL) > 100');
    expect(sql).toContain(`"region" != 'Other'`);
  });

  it('filter with IN operator', () => {
    const sql = compileDsl(table, {
      select: ['region'],
      filter: [{ field: 'region', op: 'in', value: ['North', 'South'] }],
    });
    expect(sql).toContain(`"region" IN ('North', 'South')`);
  });

  it('filter with BETWEEN operator', () => {
    const sql = compileDsl(table, {
      select: ['date', 'revenue'],
      filter: [{ field: 'date', op: 'between', value: ['2024-01-01', '2024-06-30'] }],
    });
    expect(sql).toContain(`"date" BETWEEN '2024-01-01' AND '2024-06-30'`);
  });

  it('filter with is_null / is_not_null', () => {
    const sql = compileDsl(table, {
      select: ['region'],
      filter: [{ field: 'region', op: 'is_null' }],
    });
    expect(sql).toContain('"region" IS NULL');
  });

  it('orderBy', () => {
    const sql = compileDsl(table, {
      select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: ['region'],
      orderBy: [{ field: 'total', direction: 'desc' }],
    });
    expect(sql).toContain('ORDER BY "total" DESC');
  });

  it('limit', () => {
    const sql = compileDsl(table, {
      select: ['region'],
      limit: 20,
    });
    expect(sql).toContain('LIMIT 20');
  });

  it('time bucketing with month', () => {
    const sql = compileDsl(table, {
      select: [{ field: 'revenue', aggregate: 'sum', as: 'revenue' }],
      groupBy: [{ field: 'date', bucket: 'month' }],
    });
    expect(sql).toMatch(/strftime|DATE_TRUNC/i);
  });

  it('auto-includes bucket column when date not in select', () => {
    const sql = compileDsl(table, {
      select: [{ field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: [{ field: 'date', bucket: 'month' }],
    });
    expect(sql).toContain('AS "date_month"');
    expect(sql).toContain('AS "total"');
  });

  it('replaces raw date field with bucket expression when both present', () => {
    const sql = compileDsl(table, {
      select: ['date', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      groupBy: [{ field: 'date', bucket: 'month' }],
    });
    expect(sql).toContain('AS "date_month"');
    // Raw "date" should NOT appear as a standalone select field — only inside strftime()
    const selectLine = sql.split('\n')[0];
    const selectItems = selectLine.replace(/^SELECT /, '').split(', ');
    expect(selectItems).not.toContain('"date"');
  });

  it('auto-includes bucket even when aggregate uses same source field', () => {
    const sql = compileDsl(table, {
      select: [
        { field: 'date', aggregate: 'count', as: 'entries' },
        { field: 'revenue', aggregate: 'sum', as: 'total' },
      ],
      groupBy: [{ field: 'date', bucket: 'month' }],
    });
    expect(sql).toContain('AS "date_month"');
    expect(sql).toContain('AS "entries"');
    expect(sql).toContain('AS "total"');
  });

  it('caps limit at 10000', () => {
    const sql = compileDsl(table, {
      select: ['region'],
      limit: 50000,
    });
    expect(sql).toContain('LIMIT 10000');
  });

  it('applies default limit of 10000 when no limit specified', () => {
    const sql = compileDsl(table, {
      select: ['region'],
    });
    expect(sql).toContain('LIMIT 10000');
  });

  it('respects user limit below cap', () => {
    const sql = compileDsl(table, {
      select: ['region'],
      limit: 1500,
    });
    expect(sql).toContain('LIMIT 1500');
  });

  // ─── PERCENTILE AGGREGATES ────────────────────────────────────────────────

  it('Postgres percentile aggregates use PERCENTILE_CONT', () => {
    const sql = compileDsl('sales', {
      select: [
        'region',
        { field: 'revenue', aggregate: 'median', as: 'median_revenue' },
        { field: 'revenue', aggregate: 'p25', as: 'p25_revenue' },
        { field: 'revenue', aggregate: 'p75', as: 'p75_revenue' },
      ],
      groupBy: ['region'],
    }, 'postgres');
    expect(sql).toContain('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST("revenue" AS REAL))');
    expect(sql).toContain('PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY CAST("revenue" AS REAL))');
    expect(sql).toContain('PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY CAST("revenue" AS REAL))');
  });

  it('SQLite percentile aggregates compile to NULL (handled by JS post-processing)', () => {
    const sql = compileDsl('sales', {
      select: [
        { field: 'revenue', aggregate: 'median', as: 'median_revenue' },
      ],
    }, 'sqlite');
    expect(sql).toContain('NULL AS "median_revenue"');
    expect(sql).not.toContain('MEDIAN');
    expect(sql).not.toContain('PERCENTILE');
  });

  it('skipLimit option omits LIMIT clause', () => {
    const sql = compileDsl('sales', {
      select: ['region'],
    }, 'sqlite', { skipLimit: true });
    expect(sql).not.toContain('LIMIT');
  });

  // ─── STDDEV AGGREGATE ────────────────────────────────────────────────────

  it('Postgres stddev uses STDDEV_POP', () => {
    const sql = compileDsl('sales', {
      select: [
        'region',
        { field: 'revenue', aggregate: 'stddev', as: 'revenue_stddev' },
      ],
      groupBy: ['region'],
    }, 'postgres');
    expect(sql).toContain('STDDEV_POP(CAST("revenue" AS REAL)) AS "revenue_stddev"');
  });

  it('MySQL stddev uses STDDEV_POP', () => {
    const sql = compileDsl('sales', {
      select: [
        { field: 'revenue', aggregate: 'stddev', as: 'revenue_stddev' },
      ],
    }, 'mysql');
    expect(sql).toContain('STDDEV_POP(CAST("revenue" AS REAL)) AS "revenue_stddev"');
  });

  it('SQLite stddev compiles to NULL (handled by JS)', () => {
    const sql = compileDsl('sales', {
      select: [
        { field: 'revenue', aggregate: 'stddev', as: 'revenue_stddev' },
      ],
    }, 'sqlite');
    expect(sql).toContain('NULL AS "revenue_stddev"');
  });

  // ─── ARBITRARY PERCENTILE ─────────────────────────────────────────────────

  it('Postgres arbitrary percentile uses PERCENTILE_CONT with custom p', () => {
    const sql = compileDsl('sales', {
      select: [
        { field: 'revenue', aggregate: 'percentile', percentile: 0.95, as: 'p95_revenue' },
        { field: 'revenue', aggregate: 'percentile', percentile: 0.99, as: 'p99_revenue' },
      ],
    }, 'postgres');
    expect(sql).toContain('PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CAST("revenue" AS REAL)) AS "p95_revenue"');
    expect(sql).toContain('PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY CAST("revenue" AS REAL)) AS "p99_revenue"');
  });

  it('SQLite arbitrary percentile compiles to NULL (handled by JS)', () => {
    const sql = compileDsl('sales', {
      select: [
        { field: 'revenue', aggregate: 'percentile', percentile: 0.9, as: 'p90_revenue' },
      ],
    }, 'sqlite');
    expect(sql).toContain('NULL AS "p90_revenue"');
  });

  // ─── HAVING CLAUSE ──────────────────────────────────────────────────────

  it('compiles having clause after GROUP BY', () => {
    const sql = compileDsl('sales', {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total_revenue' },
      ],
      groupBy: ['region'],
      having: [{ field: 'total_revenue', op: '>', value: 1000000 }],
      orderBy: [{ field: 'total_revenue', direction: 'desc' }],
    });
    expect(sql).toContain('HAVING');
    expect(sql).toContain('CAST("total_revenue" AS REAL) > 1000000');
    const havingIdx = sql.indexOf('HAVING');
    const groupByIdx = sql.indexOf('GROUP BY');
    const orderByIdx = sql.indexOf('ORDER BY');
    expect(havingIdx).toBeGreaterThan(groupByIdx);
    expect(havingIdx).toBeLessThan(orderByIdx);
  });

  it('compiles having with multiple conditions', () => {
    const sql = compileDsl('sales', {
      select: [
        'region',
        { field: 'revenue', aggregate: 'sum', as: 'total' },
        { field: 'revenue', aggregate: 'count', as: 'n' },
      ],
      groupBy: ['region'],
      having: [
        { field: 'total', op: '>', value: 1000 },
        { field: 'n', op: '>=', value: 10 },
      ],
    });
    expect(sql).toContain('HAVING');
    expect(sql).toContain('CAST("total" AS REAL) > 1000');
    expect(sql).toContain('CAST("n" AS REAL) >= 10');
  });

  // ─── JOIN COMPILATION ──────────────────────────────────────────────────────

  describe('JOIN compilation', () => {
    it('simple left join (default type)', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: ['products.product_category_name', { field: 'price', aggregate: 'sum', as: 'revenue' }],
        groupBy: ['products.product_category_name'],
      });
      expect(sql).toContain('LEFT JOIN "products" ON "order_items"."product_id" = "products"."product_id"');
      expect(sql).toContain('"products"."product_category_name"');
      expect(sql).toContain('SUM(CAST("price" AS REAL))');
      expect(sql).toContain('GROUP BY "products"."product_category_name"');
    });

    it('inner join', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'orders', on: { left: 'order_id', right: 'order_id' }, type: 'inner' },
        ],
        select: ['order_id'],
      });
      expect(sql).toContain('INNER JOIN "orders" ON "order_items"."order_id" = "orders"."order_id"');
    });

    it('chained joins (3 tables)', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'orders', on: { left: 'order_id', right: 'order_id' }, type: 'inner' },
          { table: 'customers', on: { left: 'orders.customer_id', right: 'customer_id' }, type: 'left' },
        ],
        select: [
          'customers.customer_state',
          { field: 'price', aggregate: 'sum', as: 'total_revenue' },
        ],
        groupBy: ['customers.customer_state'],
      });
      expect(sql).toContain('INNER JOIN "orders" ON "order_items"."order_id" = "orders"."order_id"');
      expect(sql).toContain('LEFT JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"');
      expect(sql).toContain('"customers"."customer_state"');
    });

    it('dot-notation in filter', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'orders', on: { left: 'order_id', right: 'order_id' } },
        ],
        select: ['order_items.order_id'],
        filter: [{ field: 'orders.order_status', op: '=', value: 'delivered' }],
      });
      expect(sql).toContain(`"orders"."order_status" = 'delivered'`);
    });

    it('dot-notation in orderBy', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: ['products.product_category_name', { field: 'price', aggregate: 'sum', as: 'revenue' }],
        groupBy: ['products.product_category_name'],
        orderBy: [{ field: 'revenue', direction: 'desc' }],
      });
      expect(sql).toContain('ORDER BY "revenue" DESC');
    });

    it('unqualified fields remain simple', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: ['price'],
      });
      expect(sql).toMatch(/SELECT "price"/);
    });

    it('time bucketing with dot-notation field in groupBy', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'orders', on: { left: 'order_id', right: 'order_id' } },
        ],
        select: [{ field: 'price', aggregate: 'sum', as: 'revenue' }],
        groupBy: [{ field: 'orders.order_purchase_timestamp', bucket: 'month' }],
      });
      expect(sql).toMatch(/strftime.*"orders"\."order_purchase_timestamp"/);
    });

    it('dot-notation in aggregate field', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: [{ field: 'order_items.price', aggregate: 'sum', as: 'revenue' }],
      });
      expect(sql).toContain('SUM(CAST("order_items"."price" AS REAL))');
    });
  });

  // ─── DOT-NOTATION ALIASING ────────────────────────────────────────────────

  describe('dot-notation aliasing', () => {
    it('dot-notation select field gets AS alias', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: ['products.product_category_name'],
      });
      expect(sql).toContain('"products"."product_category_name" AS "products_product_category_name"');
    });

    it('plain fields do not get aliased', () => {
      const sql = compileDsl('sales', {
        select: ['region', 'revenue'],
      });
      expect(sql).toContain('SELECT "region", "revenue"');
      expect(sql).not.toContain(' AS ');
    });

    it('same-name columns from different tables get distinct aliases', () => {
      const sql = compileDsl('results', {
        join: [
          { table: 'drivers', on: { left: 'driverId', right: 'driverId' } },
          { table: 'constructors', on: { left: 'constructorId', right: 'constructorId' } },
        ],
        select: ['drivers.nationality', 'constructors.nationality'],
      });
      expect(sql).toContain('"drivers"."nationality" AS "drivers_nationality"');
      expect(sql).toContain('"constructors"."nationality" AS "constructors_nationality"');
    });
  });

  // ─── WINDOW FUNCTIONS ──────────────────────────────────────────────────────

  describe('window functions', () => {
    it('hasWindowFunctions detects window fields', () => {
      expect(hasWindowFunctions({
        select: ['region', { window: 'rank', as: 'rnk', orderBy: [{ field: 'total', direction: 'desc' }] }],
      })).toBe(true);
      expect(hasWindowFunctions({
        select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
      })).toBe(false);
    });

    it('lag compiles to CTE with LAG()', () => {
      const sql = compileDsl('sales', {
        select: [
          'month',
          { field: 'revenue', aggregate: 'sum', as: 'monthly_revenue' },
          { window: 'lag', field: 'monthly_revenue', offset: 1, as: 'prev_month', orderBy: [{ field: 'month', direction: 'asc' }] },
        ],
        groupBy: ['month'],
      });
      expect(sql).toContain('WITH _base AS');
      expect(sql).toContain('LAG("monthly_revenue", 1)');
      expect(sql).toContain('ORDER BY "month" ASC');
      expect(sql).toContain('AS "prev_month"');
      expect(sql).toContain('SELECT _base.*');
    });

    it('lead compiles with offset and default', () => {
      const sql = compileDsl('sales', {
        select: [
          'month',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'lead', field: 'total', offset: 2, default: 0, as: 'next_2', orderBy: [{ field: 'month', direction: 'asc' }] },
        ],
        groupBy: ['month'],
      });
      expect(sql).toContain('LEAD("total", 2, 0)');
      expect(sql).toContain('AS "next_2"');
    });

    it('rank compiles without field', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'rank', as: 'rnk', orderBy: [{ field: 'total', direction: 'desc' }] },
        ],
        groupBy: ['region'],
      });
      expect(sql).toContain('RANK() OVER (ORDER BY "total" DESC)');
      expect(sql).toContain('AS "rnk"');
    });

    it('dense_rank compiles correctly', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'dense_rank', as: 'drnk', orderBy: [{ field: 'total', direction: 'desc' }] },
        ],
        groupBy: ['region'],
      });
      expect(sql).toContain('DENSE_RANK() OVER (ORDER BY "total" DESC)');
    });

    it('row_number compiles correctly', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'row_number', as: 'rn', orderBy: [{ field: 'total', direction: 'desc' }] },
        ],
        groupBy: ['region'],
      });
      expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY "total" DESC)');
    });

    it('running_sum compiles with ROWS UNBOUNDED PRECEDING', () => {
      const sql = compileDsl('sales', {
        select: [
          'month',
          { field: 'revenue', aggregate: 'sum', as: 'monthly' },
          { window: 'running_sum', field: 'monthly', as: 'cumulative', orderBy: [{ field: 'month', direction: 'asc' }] },
        ],
        groupBy: ['month'],
      });
      expect(sql).toContain('SUM("monthly") OVER (ORDER BY "month" ASC ROWS UNBOUNDED PRECEDING)');
    });

    it('running_avg compiles with ROWS UNBOUNDED PRECEDING', () => {
      const sql = compileDsl('sales', {
        select: [
          'month',
          { field: 'revenue', aggregate: 'sum', as: 'monthly' },
          { window: 'running_avg', field: 'monthly', as: 'avg_so_far', orderBy: [{ field: 'month', direction: 'asc' }] },
        ],
        groupBy: ['month'],
      });
      expect(sql).toContain('AVG("monthly") OVER (ORDER BY "month" ASC ROWS UNBOUNDED PRECEDING)');
    });

    it('pct_of_total compiles as field / SUM(field) OVER', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'pct_of_total', field: 'total', as: 'pct' },
        ],
        groupBy: ['region'],
      });
      expect(sql).toContain('CAST("total" AS REAL) / SUM("total") OVER ()');
      expect(sql).toContain('AS "pct"');
    });

    it('pct_of_total with partitionBy', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          'category',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'pct_of_total', field: 'total', as: 'pct_in_region', partitionBy: ['region'] },
        ],
        groupBy: ['region', 'category'],
      });
      expect(sql).toContain('PARTITION BY "region"');
    });

    it('window with partitionBy', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          'month',
          { field: 'revenue', aggregate: 'sum', as: 'monthly' },
          { window: 'lag', field: 'monthly', as: 'prev', partitionBy: ['region'], orderBy: [{ field: 'month', direction: 'asc' }] },
        ],
        groupBy: ['region', 'month'],
      });
      expect(sql).toContain('PARTITION BY "region" ORDER BY "month" ASC');
    });

    it('base CTE has no ORDER BY or LIMIT', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'rank', as: 'rnk', orderBy: [{ field: 'total', direction: 'desc' }] },
        ],
        groupBy: ['region'],
        orderBy: [{ field: 'rnk', direction: 'asc' }],
        limit: 10,
      });
      const cteMatch = sql.match(/WITH _base AS \(\n([\s\S]+?)\n\)/);
      expect(cteMatch).toBeTruthy();
      const cteSql = cteMatch![1];
      expect(cteSql).not.toContain('ORDER BY');
      expect(cteSql).not.toContain('LIMIT');
      expect(sql).toContain('ORDER BY "rnk" ASC');
      expect(sql).toContain('LIMIT 10');
    });

    it('multiple windows with different partitions', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          'month',
          { field: 'revenue', aggregate: 'sum', as: 'total' },
          { window: 'rank', as: 'global_rank', orderBy: [{ field: 'total', direction: 'desc' }] },
          { window: 'rank', as: 'region_rank', partitionBy: ['region'], orderBy: [{ field: 'total', direction: 'desc' }] },
        ],
        groupBy: ['region', 'month'],
      });
      expect(sql).toContain('RANK() OVER (ORDER BY "total" DESC) AS "global_rank"');
      expect(sql).toContain('RANK() OVER (PARTITION BY "region" ORDER BY "total" DESC) AS "region_rank"');
    });

    it('window without aggregation (plain fields + row_number)', () => {
      const sql = compileDsl('sales', {
        select: [
          'region',
          'revenue',
          { window: 'row_number', as: 'rn', orderBy: [{ field: 'revenue', direction: 'desc' }] },
        ],
      });
      expect(sql).toContain('WITH _base AS');
      expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY "revenue" DESC)');
    });

    it('window orderBy with dot-notation uses aliased name', () => {
      const sql = compileDsl('results', {
        join: [
          { table: 'races', on: { left: 'raceId', right: 'raceId' } },
        ],
        select: [
          'races.year',
          { field: 'position', aggregate: 'avg', as: 'avg_pos' },
          { window: 'lag', field: 'avg_pos', as: 'prev_avg', orderBy: [{ field: 'races.year', direction: 'asc' }] },
        ],
        groupBy: ['races.year'],
      });
      expect(sql).toContain('ORDER BY "races_year" ASC');
      expect(sql).not.toContain('ORDER BY "year" ASC');
    });

    it('outer orderBy with dot-notation uses aliased name', () => {
      const sql = compileDsl('results', {
        join: [
          { table: 'races', on: { left: 'raceId', right: 'raceId' } },
        ],
        select: [
          'races.year',
          { field: 'position', aggregate: 'avg', as: 'avg_pos' },
          { window: 'rank', as: 'rnk', orderBy: [{ field: 'avg_pos', direction: 'asc' }] },
        ],
        groupBy: ['races.year'],
        orderBy: [{ field: 'races.year', direction: 'asc' }],
      });
      const outerOrderBy = sql.split('FROM _base')[1];
      expect(outerOrderBy).toContain('ORDER BY "races_year" ASC');
    });

    it('partitionBy with dot-notation uses aliased name in CTE', () => {
      const sql = compileDsl('order_items', {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: [
          'products.category',
          { field: 'price', aggregate: 'sum', as: 'revenue' },
          { window: 'rank', as: 'cat_rank', partitionBy: ['products.category'], orderBy: [{ field: 'revenue', direction: 'desc' }] },
        ],
        groupBy: ['products.category'],
      });
      expect(sql).toContain('PARTITION BY "products_category"');
      expect(sql).not.toContain('PARTITION BY "products.category"');
    });
  });
});
