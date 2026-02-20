/**
 * MCP Tool: visualize_data
 * Takes a data source + DSL query + intent and returns visualization
 * recommendations from the handcrafted pattern library.
 *
 * For inline data, use the `visualize` tool instead.
 */

import { z } from 'zod';
import type { VisualizeInput, VisualizeOutput } from '../../types.js';
import { dslQuerySchema, ALL_PALETTE_NAMES } from './dsl-schemas.js';
import {
  columnsSchema,
  dataShapeHintsSchema,
  handleVisualizeCore,
} from './visualize.js';
import { errorResponse, inferColumns, applyTimeBucketColumnTypes, enhanceIntentForTimeBucket } from './shared.js';
import { logOperation, extractDslStructure } from './operation-log.js';

export const visualizeFromSourceInputSchema = z.object({
  sourceId: z.string().describe('Dataset ID returned by load_csv'),
  table: z.string().describe('Base table within the source'),
  query: dslQuerySchema.describe('Declarative query to slice/aggregate the data before visualizing'),
  intent: z.string().describe('What the user wants to see — e.g., "compare sales by region", "show distribution of ages", "how do rankings change over time"'),
  columns: columnsSchema,
  dataShapeHints: dataShapeHintsSchema,
  pattern: z.string().optional().describe('Force a specific chart pattern by ID (e.g. "bar", "beeswarm", "stream-graph"). Use list_patterns to discover IDs. Bypasses scoring; alternatives still returned.'),
  title: z.string().optional().describe('Chart title — set upfront to avoid a refine round-trip'),
  subtitle: z.string().optional().describe('Chart subtitle — set upfront to avoid a refine round-trip'),
  includeDataTable: z.boolean().optional().describe('Whether to add a companion sortable data table with linked highlighting below the chart. Default: true'),
  palette: z.enum(ALL_PALETTE_NAMES).optional()
    .describe('Named palette: categorical, blue, green, purple, warm, blueRed, etc.'),
  highlight: z.object({
    values: z.array(z.union([z.string(), z.number()])).describe('Values to emphasize'),
    color: z.union([z.string(), z.array(z.string())]).optional(),
    mutedColor: z.string().optional(),
    mutedOpacity: z.number().optional(),
  }).optional(),
  colorField: z.string().optional().describe('Which data field to base colors on'),
  maxAlternativeChartTypes: z.number().optional().describe('Max alternative chart type recommendations to return (default: 2, set 0 for none)'),
  geoLevel: z.enum(['country', 'subdivision']).optional()
    .describe('Geographic level: "country" (each row = a nation) or "subdivision" (each row = a state/province). Auto-detected if omitted.'),
  geoRegion: z.string().optional()
    .describe('Geographic region code: "world", ISO country code (US, CN, AU, etc.), or continent (EU, AF, AS, SA, NA, OC). Auto-detected if omitted.'),
});

export function handleVisualizeFromSource(
  selectPatterns: (input: VisualizeInput) => VisualizeOutput,
  deps: { sourceManager: any },
) {
  const core = handleVisualizeCore(selectPatterns, 'visualize_data');

  return async (args: z.infer<typeof visualizeFromSourceInputSchema>) => {
    const start = Date.now();

    if (!deps.sourceManager) {
      return errorResponse('Source manager not available.');
    }

    const source = deps.sourceManager.get?.(args.sourceId);
    const sourceType = source?.type;

    const result = await deps.sourceManager.queryDsl(args.sourceId, args.table, args.query);
    if (!result.ok) {
      logOperation({
        toolName: 'visualize_data',
        timestamp: start,
        durationMs: Date.now() - start,
        success: false,
        meta: {
          dslStructure: extractDslStructure(args.query),
          sourceType,
          error: result.error,
        },
      });
      return errorResponse(result.error);
    }

    // Enrich column types and intent with time bucket context (matches dashboard behavior)
    if (!args.columns && args.query.groupBy) {
      const columns = inferColumns(result.rows);
      applyTimeBucketColumnTypes(columns, args.query.groupBy);
      args = { ...args, columns: columns as any };
    }
    const enrichedIntent = enhanceIntentForTimeBucket(args.intent, args.query.groupBy);

    return core(result.rows, { ...args, intent: enrichedIntent }, { truncated: result.truncated, totalSourceRows: result.totalRows }, {
      dslStructure: extractDslStructure(args.query),
      sourceType,
    });
  };
}
