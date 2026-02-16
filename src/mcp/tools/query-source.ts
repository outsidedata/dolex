/**
 * MCP Tool: query_source
 * Execute a DSL query against a source and return tabular results.
 */

import { z } from 'zod';
import { dslQuerySchema } from './dsl-schemas.js';
import { saveResult } from './result-cache.js';
import { errorResponse, jsonResponse } from './shared.js';
import { logOperation, extractDslStructure } from './operation-log.js';

export const querySourceInputSchema = z.object({
  sourceId: z.string().describe('Source ID from add_source'),
  table: z.string().describe('Table name within the source'),
  query: dslQuerySchema.describe('Declarative query (join, select, groupBy, filter, orderBy, limit). Use join to combine tables; use table.field dot notation for joined table fields. Example: { select: ["region", { field: "revenue", aggregate: "sum", as: "total" }], groupBy: ["region"], orderBy: [{ field: "total", direction: "desc" }], limit: 10 }'),
  maxRows: z.number().optional().describe('Max rows to return (default: 20)'),
});

export function handleQuerySource(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof querySourceInputSchema>) => {
    const start = Date.now();

    const query = { ...args.query };
    if (args.maxRows) {
      query.limit = Math.min(args.maxRows, query.limit ?? Infinity);
    }

    const result = await deps.sourceManager.queryDsl(args.sourceId, args.table, query);
    if (!result.ok) {
      logOperation({
        toolName: 'query_source',
        timestamp: start,
        durationMs: Date.now() - start,
        success: false,
        meta: {
          dslStructure: extractDslStructure(args.query),
          error: result.error,
        },
      });
      return errorResponse(result.error);
    }

    const resultId = saveResult(result.rows, result.columns);

    logOperation({
      toolName: 'query_source',
      timestamp: start,
      durationMs: Date.now() - start,
      success: true,
      meta: {
        dslStructure: extractDslStructure(args.query),
        dataShape: {
          rowCount: result.rows.length,
          columnCount: result.columns.length,
          columns: result.columns,
        },
      },
    });

    return jsonResponse({
      resultId,
      columns: result.columns,
      rows: result.rows,
      totalRows: result.totalRows,
      truncated: result.truncated ?? false,
      queryTimeMs: Date.now() - start,
    });
  };
}
