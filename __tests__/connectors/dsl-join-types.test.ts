import { describe, it, expect } from 'vitest';
import type { DslQuery, DslJoin } from '../../src/types.js';

describe('DslJoin type shape', () => {
  it('compiles a DslQuery with join array', () => {
    const query: DslQuery = {
      join: [
        {
          table: 'products',
          on: { left: 'product_id', right: 'product_id' },
          type: 'left',
        },
      ],
      select: ['products.product_category_name', { field: 'price', aggregate: 'sum', as: 'revenue' }],
      groupBy: ['products.product_category_name'],
      orderBy: [{ field: 'revenue', direction: 'desc' }],
      limit: 10,
    };
    expect(query.join).toHaveLength(1);
    expect(query.join![0].table).toBe('products');
    expect(query.join![0].on.left).toBe('product_id');
    expect(query.join![0].on.right).toBe('product_id');
    expect(query.join![0].type).toBe('left');
  });

  it('join type defaults to undefined (applied at compile time)', () => {
    const join: DslJoin = {
      table: 'orders',
      on: { left: 'order_id', right: 'order_id' },
    };
    expect(join.type).toBeUndefined();
  });

  it('supports chained joins', () => {
    const query: DslQuery = {
      join: [
        { table: 'orders', on: { left: 'order_id', right: 'order_id' }, type: 'inner' },
        { table: 'customers', on: { left: 'orders.customer_id', right: 'customer_id' } },
      ],
      select: ['customers.customer_state', { field: 'price', aggregate: 'sum', as: 'total' }],
      groupBy: ['customers.customer_state'],
    };
    expect(query.join).toHaveLength(2);
    expect(query.join![1].on.left).toBe('orders.customer_id');
  });
});
