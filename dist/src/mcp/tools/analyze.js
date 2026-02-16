/**
 * MCP Tool: analyze_source
 * Examines a data source and generates a structured analysis plan with DSL queries.
 */
import { z } from 'zod';
import { buildAnalysisPlan } from '../../analysis/planner.js';
import { errorResponse, jsonResponse } from './shared.js';
export const analyzeSourceInputSchema = z.object({
    sourceId: z.string().describe('Source ID from add_source'),
    table: z.string().optional().describe('Table to analyze (defaults to first table)'),
    maxSteps: z.number().min(1).max(10).optional().describe('Maximum analysis steps (default: 6)'),
});
export function handleAnalyzeSource(deps) {
    return async (args) => {
        const schemaResult = await deps.sourceManager.getSchema(args.sourceId);
        if (!schemaResult.ok || !schemaResult.schema) {
            return errorResponse(schemaResult.error ?? `Source not found: ${args.sourceId}`);
        }
        const tables = schemaResult.schema.tables;
        const targetTable = args.table
            ? tables.find((t) => t.name === args.table)
            : tables[0];
        if (!targetTable) {
            const available = tables.map((t) => t.name).join(', ');
            const message = args.table
                ? `Table "${args.table}" not found. Available: ${available}`
                : 'No tables found in source';
            return errorResponse(message);
        }
        const plan = buildAnalysisPlan(targetTable.columns, targetTable.name, schemaResult.schema.source?.name ?? args.sourceId, args.maxSteps ?? 6);
        return jsonResponse(plan);
    };
}
//# sourceMappingURL=analyze.js.map