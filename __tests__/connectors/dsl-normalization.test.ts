import { describe, it, expect } from 'vitest';
import { normalizeDslQueryInput } from '../../src/mcp/tools/dsl-schemas.js';
import { dslQuerySchema } from '../../src/mcp/tools/dsl-schemas.js';

describe('normalizeDslQueryInput', () => {
  describe('bare object → array wrapping', () => {
    it('wraps a single filter object into an array', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'status', op: '=', value: 'active' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
    });

    it('leaves filter array unchanged', () => {
      const raw = {
        select: ['name'],
        filter: [{ field: 'status', op: '=', value: 'active' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
    });

    it('wraps a single orderBy object into an array', () => {
      const raw = {
        select: ['name'],
        orderBy: { field: 'total', direction: 'desc' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.orderBy).toEqual([{ field: 'total', direction: 'desc' }]);
    });

    it('wraps a single having object into an array', () => {
      const raw = {
        select: [{ field: 'amount', aggregate: 'sum', as: 'total' }],
        having: { field: 'total', op: '>', value: 1000 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.having).toEqual([{ field: 'total', op: '>', value: 1000 }]);
    });

    it('leaves undefined fields unchanged', () => {
      const raw = { select: ['name'] };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toBeUndefined();
      expect(result.orderBy).toBeUndefined();
      expect(result.having).toBeUndefined();
    });
  });

  describe('filter shorthand aliases', () => {
    it('normalizes { field, equals: value } → { field, op: "=", value }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'status', equals: 'active' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
    });

    it('normalizes { field, not_equals: value }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'status', not_equals: 'inactive' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: '!=', value: 'inactive' }]);
    });

    it('normalizes { field, gt: value }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'amount', gt: 100 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'amount', op: '>', value: 100 }]);
    });

    it('normalizes { field, gte: value }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'amount', gte: 100 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'amount', op: '>=', value: 100 }]);
    });

    it('normalizes { field, lt: value }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'amount', lt: 50 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'amount', op: '<', value: 50 }]);
    });

    it('normalizes { field, lte: value }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'amount', lte: 50 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'amount', op: '<=', value: 50 }]);
    });

    it('normalizes shorthand inside an array', () => {
      const raw = {
        select: ['name'],
        filter: [
          { field: 'status', equals: 'active' },
          { field: 'amount', gt: 100 },
        ],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([
        { field: 'status', op: '=', value: 'active' },
        { field: 'amount', op: '>', value: 100 },
      ]);
    });

    it('normalizes shorthand in having', () => {
      const raw = {
        select: [{ field: 'amount', aggregate: 'sum', as: 'total' }],
        having: { field: 'total', gt: 1000 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.having).toEqual([{ field: 'total', op: '>', value: 1000 }]);
    });

    it('does not touch canonical filters', () => {
      const raw = {
        select: ['name'],
        filter: [
          { field: 'status', op: '=', value: 'active' },
          { field: 'category', op: 'in', value: ['A', 'B'] },
        ],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual(raw.filter);
    });
  });

  describe('"operator" → "op" alias in filters', () => {
    it('normalizes { operator: "=" } → { op: "=" }', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'status', operator: '=', value: 'active' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
    });

    it('normalizes operator in having', () => {
      const raw = {
        select: [{ field: 'amount', aggregate: 'sum', as: 'total' }],
        having: { field: 'total', operator: '>', value: 1000 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.having).toEqual([{ field: 'total', op: '>', value: 1000 }]);
    });

    it('normalizes { operator: "in" } with array value', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'status', operator: 'in', value: ['active', 'pending'] },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: 'in', value: ['active', 'pending'] }]);
    });

    it('prefers canonical "op" over "operator" when both present', () => {
      const raw = {
        select: ['name'],
        filter: { field: 'status', op: '=', operator: '!=', value: 'active' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter[0].op).toBe('=');
    });
  });

  describe('"column" → "field" alias', () => {
    it('normalizes column in filter', () => {
      const raw = {
        select: ['name'],
        filter: { column: 'status', op: '=', value: 'active' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
    });

    it('normalizes column in orderBy', () => {
      const raw = {
        select: ['name'],
        orderBy: { column: 'total', direction: 'desc' },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.orderBy).toEqual([{ field: 'total', direction: 'desc' }]);
    });

    it('normalizes column in select aggregate', () => {
      const raw = {
        select: [{ column: 'amount', aggregate: 'sum', as: 'total' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual([{ field: 'amount', aggregate: 'sum', as: 'total' }]);
    });

    it('normalizes column in groupBy bucket', () => {
      const raw = {
        select: ['name'],
        groupBy: [{ column: 'order_date', bucket: 'month' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.groupBy).toEqual([{ field: 'order_date', bucket: 'month' }]);
    });

    it('normalizes column + operator together in filter', () => {
      const raw = {
        select: ['name'],
        filter: { column: 'amount', operator: '>', value: 100 },
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.filter).toEqual([{ field: 'amount', op: '>', value: 100 }]);
    });
  });

  describe('orderBy bare strings', () => {
    it('normalizes bare string to ascending sort', () => {
      const raw = {
        select: ['name'],
        orderBy: 'total',
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.orderBy).toEqual([{ field: 'total', direction: 'asc' }]);
    });

    it('normalizes array of bare strings', () => {
      const raw = {
        select: ['name'],
        orderBy: ['region', 'total'],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.orderBy).toEqual([
        { field: 'region', direction: 'asc' },
        { field: 'total', direction: 'asc' },
      ]);
    });

    it('normalizes mixed bare strings and objects', () => {
      const raw = {
        select: ['name'],
        orderBy: ['region', { field: 'total', direction: 'desc' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.orderBy).toEqual([
        { field: 'region', direction: 'asc' },
        { field: 'total', direction: 'desc' },
      ]);
    });
  });

  describe('select aggregate shorthand', () => {
    it('normalizes { count: "id", as: "total" }', () => {
      const raw = {
        select: ['region', { count: 'id', as: 'total' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual([
        'region',
        { field: 'id', aggregate: 'count', as: 'total' },
      ]);
    });

    it('normalizes { sum: "revenue", as: "total_revenue" }', () => {
      const raw = {
        select: [{ sum: 'revenue', as: 'total_revenue' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual([
        { field: 'revenue', aggregate: 'sum', as: 'total_revenue' },
      ]);
    });

    it('normalizes { avg: "price", as: "avg_price" }', () => {
      const raw = {
        select: [{ avg: 'price', as: 'avg_price' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual([
        { field: 'price', aggregate: 'avg', as: 'avg_price' },
      ]);
    });

    it('normalizes { count: "*", as: "total" }', () => {
      const raw = {
        select: [{ count: '*', as: 'total' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual([
        { field: '*', aggregate: 'count', as: 'total' },
      ]);
    });

    it('does not touch canonical aggregate objects', () => {
      const raw = {
        select: [{ field: 'revenue', aggregate: 'sum', as: 'total' }],
      };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual([{ field: 'revenue', aggregate: 'sum', as: 'total' }]);
    });

    it('does not touch plain strings', () => {
      const raw = { select: ['name', 'region'] };
      const result = normalizeDslQueryInput(raw) as any;
      expect(result.select).toEqual(['name', 'region']);
    });
  });
});

describe('dslQuerySchema with normalization', () => {
  it('parses bare filter object', () => {
    const input = {
      select: ['name'],
      filter: { field: 'status', op: '=', value: 'active' },
    };
    const result = dslQuerySchema.parse(input);
    expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
  });

  it('parses filter shorthand through Zod', () => {
    const input = {
      select: ['name'],
      filter: { field: 'status', equals: 'active' },
    };
    const result = dslQuerySchema.parse(input);
    expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
  });

  it('parses bare orderBy object through Zod', () => {
    const input = {
      select: ['name'],
      orderBy: { field: 'total', direction: 'desc' as const },
    };
    const result = dslQuerySchema.parse(input);
    expect(result.orderBy).toEqual([{ field: 'total', direction: 'desc' }]);
  });

  it('parses mixed shorthand + canonical filters', () => {
    const input = {
      select: ['name'],
      filter: [
        { field: 'status', equals: 'active' },
        { field: 'amount', op: '>', value: 100 },
      ],
    };
    const result = dslQuerySchema.parse(input);
    expect(result.filter).toEqual([
      { field: 'status', op: '=', value: 'active' },
      { field: 'amount', op: '>', value: 100 },
    ]);
  });

  it('parses "operator" alias through Zod', () => {
    const input = {
      select: ['name'],
      filter: { field: 'status', operator: 'in', value: ['a', 'b'] },
    };
    const result = dslQuerySchema.parse(input);
    expect(result.filter).toEqual([{ field: 'status', op: 'in', value: ['a', 'b'] }]);
  });

  it('parses "column" alias in orderBy through Zod', () => {
    const input = {
      select: ['name'],
      orderBy: { column: 'total', direction: 'desc' as const },
    };
    const result = dslQuerySchema.parse(input);
    expect(result.orderBy).toEqual([{ field: 'total', direction: 'desc' }]);
  });

  it('parses bare string orderBy through Zod', () => {
    const input = {
      select: ['name'],
      orderBy: 'total',
    };
    const result = dslQuerySchema.parse(input);
    expect(result.orderBy).toEqual([{ field: 'total', direction: 'asc' }]);
  });

  it('parses aggregate shorthand through Zod', () => {
    const input = {
      select: ['region', { sum: 'revenue', as: 'total' }],
      groupBy: ['region'],
    };
    const result = dslQuerySchema.parse(input);
    expect(result.select).toEqual([
      'region',
      { field: 'revenue', aggregate: 'sum', as: 'total' },
    ]);
  });

  it('parses combined aliases: column + operator + aggregate shorthand', () => {
    const input = {
      select: ['region', { count: 'id', as: 'n' }],
      filter: { column: 'status', operator: '=', value: 'active' },
      groupBy: ['region'],
      orderBy: { column: 'n', direction: 'desc' as const },
    };
    const result = dslQuerySchema.parse(input);
    expect(result.filter).toEqual([{ field: 'status', op: '=', value: 'active' }]);
    expect(result.select).toEqual(['region', { field: 'id', aggregate: 'count', as: 'n' }]);
    expect(result.orderBy).toEqual([{ field: 'n', direction: 'desc' }]);
  });
});
