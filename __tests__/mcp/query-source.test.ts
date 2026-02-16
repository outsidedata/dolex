import { describe, it, expect } from 'vitest';
import { handleQuerySource } from '../../src/mcp/tools/query-source.js';
import { SourceManager } from '../../src/connectors/manager.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('query_source MCP tool', () => {
  it('executes a DSL query and returns tabular results', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qsrc-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    fs.writeFileSync(csvPath, 'region,revenue\nNorth,100\nSouth,200\nNorth,150');

    const sourceManager = new SourceManager();
    const addResult = await sourceManager.add('test', { type: 'csv', path: csvPath });

    const handler = handleQuerySource({ sourceManager });
    const result = await handler({
      sourceId: addResult.entry!.id,
      table: 'data',
      query: {
        select: ['region', { field: 'revenue', aggregate: 'sum', as: 'total' }],
        groupBy: ['region'],
        orderBy: [{ field: 'total', direction: 'desc' }],
      },
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.columns).toContain('region');
    expect(body.columns).toContain('total');
    expect(body.rows.length).toBe(2);
    expect(body.queryTimeMs).toBeDefined();

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('respects maxRows parameter', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qsrc-'));
    const csvPath = path.join(tmpDir, 'data.csv');
    const rows = Array.from({ length: 50 }, (_, i) => `item${i},${i}`);
    fs.writeFileSync(csvPath, `name,value\n${rows.join('\n')}`);

    const sourceManager = new SourceManager();
    await sourceManager.add('big', { type: 'csv', path: csvPath });

    const handler = handleQuerySource({ sourceManager });
    const result = await handler({
      sourceId: 'big',
      table: 'data',
      query: { select: ['name', 'value'] },
      maxRows: 5,
    });

    const body = JSON.parse(result.content[0].text);
    expect(body.rows.length).toBe(5);

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('executes a join query through query_source', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qsrc-join-'));
    fs.writeFileSync(path.join(tmpDir, 'order_items.csv'), [
      'order_id,product_id,price',
      '1,101,50',
      '2,102,75',
      '3,101,50',
    ].join('\n'));
    fs.writeFileSync(path.join(tmpDir, 'products.csv'), [
      'product_id,product_category_name',
      '101,Electronics',
      '102,Clothing',
    ].join('\n'));

    const sourceManager = new SourceManager();
    const addResult = await sourceManager.add('ecom', { type: 'csv', path: tmpDir });

    const handler = handleQuerySource({ sourceManager });
    const result = await handler({
      sourceId: addResult.entry!.id,
      table: 'order_items',
      query: {
        join: [
          { table: 'products', on: { left: 'product_id', right: 'product_id' } },
        ],
        select: [
          'products.product_category_name',
          { field: 'price', aggregate: 'sum', as: 'revenue' },
        ],
        groupBy: ['products.product_category_name'],
        orderBy: [{ field: 'revenue', direction: 'desc' }],
      },
    });

    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text);
    expect(body.rows.length).toBe(2);
    // Electronics: 50+50=100, Clothing: 75
    expect(body.rows[0].product_category_name).toBe('Electronics');
    expect(body.rows[0].revenue).toBe(100);

    await sourceManager.closeAll();
    fs.rmSync(tmpDir, { recursive: true });
  });
});
