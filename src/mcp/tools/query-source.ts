/**
 * MCP Tool: query_data
 * Execute a SQL query against a source and return tabular results.
 */

import { z } from 'zod';
import { saveResult } from './result-cache.js';
import { errorResponse, jsonResponse } from './shared.js';
import { logOperation } from './operation-log.js';

export const querySourceInputSchema = z.object({
  sourceId: z.string().describe('Dataset ID returned by load_csv'),
  sql: z.string().describe('SQL SELECT query. Use table and column names from load_csv/describe_data. Supports JOINs, GROUP BY, HAVING, window functions, CTEs. Custom aggregates: MEDIAN, STDDEV, P25, P75, P10, P90.'),
  maxRows: z.number().optional().describe('Max rows to return (default: 10000)'),
});

export function handleQuerySource(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof querySourceInputSchema>) => {
    const start = Date.now();

    const result = await deps.sourceManager.querySql(args.sourceId, args.sql, args.maxRows);
    if (!result.ok) {
      logOperation({
        toolName: 'query_data',
        timestamp: start,
        durationMs: Date.now() - start,
        success: false,
        meta: {
          sqlPreview: args.sql.slice(0, 200),
          error: result.error,
        },
      });
      return errorResponse(result.error);
    }

    const resultId = saveResult(result.rows, result.columns);

    logOperation({
      toolName: 'query_data',
      timestamp: start,
      durationMs: Date.now() - start,
      success: true,
      meta: {
        sqlPreview: args.sql.slice(0, 200),
        dataShape: {
          rowCount: result.rows!.length,
          columnCount: result.columns!.length,
          columns: result.columns!,
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
