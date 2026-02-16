/**
 * MCP Tool: visualize_from_source
 * Takes a data source + DSL query + intent and returns visualization
 * recommendations from the handcrafted pattern library.
 *
 * For inline data, use the `visualize` tool instead.
 */
import { z } from 'zod';
import { dslQuerySchema } from './dsl-schemas.js';
import { colorPreferencesSchema, columnsSchema, dataShapeHintsSchema, handleVisualizeCore, } from './visualize.js';
import { errorResponse } from './shared.js';
import { logOperation, extractDslStructure } from './operation-log.js';
export const visualizeFromSourceInputSchema = z.object({
    sourceId: z.string().describe('Source ID from add_source'),
    table: z.string().describe('Base table within the source'),
    query: dslQuerySchema.describe('Declarative query to slice/aggregate the data before visualizing'),
    intent: z.string().describe('What the user wants to see — e.g., "compare sales by region", "show distribution of ages", "how do rankings change over time"'),
    columns: columnsSchema,
    dataShapeHints: dataShapeHintsSchema,
    pattern: z.string().optional().describe('Force a specific chart pattern by ID (e.g. "bar", "beeswarm", "stream-graph"). Use list_patterns to discover IDs. Bypasses scoring; alternatives still returned.'),
    title: z.string().optional().describe('Chart title — set upfront to avoid a refine round-trip'),
    subtitle: z.string().optional().describe('Chart subtitle — set upfront to avoid a refine round-trip'),
    includeDataTable: z.boolean().optional().describe('Whether to add a companion sortable data table with linked highlighting below the chart. Default: true'),
    colorPreferences: colorPreferencesSchema,
    maxAlternativeChartTypes: z.number().optional().describe('Max alternative chart type recommendations to return (default: 2, set 0 for none)'),
    geoLevel: z.enum(['country', 'subdivision']).optional()
        .describe('Geographic level: "country" (each row = a nation) or "subdivision" (each row = a state/province). Auto-detected if omitted.'),
    geoRegion: z.string().optional()
        .describe('Geographic region code: "world", ISO country code (US, CN, AU, etc.), or continent (EU, AF, AS, SA, NA, OC). Auto-detected if omitted.'),
});
export function handleVisualizeFromSource(selectPatterns, deps) {
    const core = handleVisualizeCore(selectPatterns, 'visualize_from_source');
    return async (args) => {
        const start = Date.now();
        if (!deps.sourceManager) {
            return errorResponse('Source manager not available.');
        }
        const source = deps.sourceManager.get?.(args.sourceId);
        const sourceType = source?.type;
        const result = await deps.sourceManager.queryDsl(args.sourceId, args.table, args.query);
        if (!result.ok) {
            logOperation({
                toolName: 'visualize_from_source',
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
        return core(result.rows, args, { truncated: result.truncated, totalSourceRows: result.totalRows }, {
            dslStructure: extractDslStructure(args.query),
            sourceType,
        });
    };
}
//# sourceMappingURL=visualize-from-source.js.map