/**
 * MCP Tool: visualize_cli_only
 *
 * FOR CLAUDE CODE / CLI USE ONLY. DO NOT USE IN CLAUDE DESKTOP.
 *
 * Same as visualize but:
 * - NEVER returns HTML in response
 * - Writes HTML directly to disk via writeTo parameter
 * - Returns only specId and metadata
 */
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { isCompoundSpec } from '../../types.js';
import { ALL_PALETTE_NAMES } from './sql-schemas.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { shouldCompound, buildCompoundSpec } from '../../renderers/html/compound.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import { getResult } from './result-cache.js';
import { errorResponse, inferColumns, applyColorPreferences } from './shared.js';
import { columnsSchema, dataShapeHintsSchema } from './visualize.js';
export const visualizeCliInputSchema = z.object({
    data: z.array(z.record(z.any())).optional().describe('Array of data rows to visualize. Optional if resultId or sourceId+sql is provided.'),
    resultId: z.string().optional().describe('Result ID from a previous query_data call'),
    sourceId: z.string().optional().describe('Dataset ID returned by load_csv'),
    sql: z.string().optional().describe('SQL SELECT query to slice/aggregate the data before visualizing.'),
    intent: z.string().describe('What the user wants to see'),
    columns: columnsSchema,
    dataShapeHints: dataShapeHintsSchema,
    pattern: z.string().optional().describe('Force a specific chart pattern by ID'),
    title: z.string().optional().describe('Chart title'),
    subtitle: z.string().optional().describe('Chart subtitle'),
    includeDataTable: z.boolean().optional().describe('Whether to add a companion data table. Default: true'),
    palette: z.enum(ALL_PALETTE_NAMES).optional().describe('Named palette'),
    highlight: z.object({
        values: z.array(z.union([z.string(), z.number()])).describe('Values to emphasize'),
        color: z.union([z.string(), z.array(z.string())]).optional(),
        mutedColor: z.string().optional(),
        mutedOpacity: z.number().optional(),
    }).optional(),
    colorField: z.string().optional().describe('Which data field to base colors on'),
    maxAlternativeChartTypes: z.number().optional().describe('Max alternative chart type recommendations to return (default: 2)'),
    geoLevel: z.enum(['country', 'subdivision']).optional().describe('Geographic level'),
    geoRegion: z.string().optional().describe('Geographic region code'),
    writeTo: z.string().describe('REQUIRED. File path to write the HTML chart to. The HTML is written to disk and NOT returned in the response.'),
});
export function handleVisualizeCli(selectPatterns, deps) {
    return async (args) => {
        let data = args.data;
        let queryMeta;
        // Path 1: sourceId + sql → server-side query
        if (args.sourceId && args.sql) {
            if (!deps?.sourceManager) {
                return errorResponse('Source manager not available.');
            }
            const result = await deps.sourceManager.querySql(args.sourceId, args.sql);
            if (!result.ok) {
                return errorResponse(result.error);
            }
            data = result.rows;
            queryMeta = { truncated: result.truncated, totalSourceRows: result.totalRows };
        }
        // Path 2: resultId → cached query result
        if (!data && args.resultId) {
            const cached = getResult(args.resultId);
            if (!cached) {
                return errorResponse(`Result "${args.resultId}" not found or expired. Re-run query_data to get a new resultId.`);
            }
            data = cached.rows;
        }
        if (!data || data.length === 0) {
            return errorResponse('No data provided. Pass data array, resultId from query_data, or sourceId + sql.');
        }
        const notes = [];
        const columns = args.columns || inferColumns(data);
        const maxAlternativeChartTypes = args.maxAlternativeChartTypes ?? 2;
        const input = {
            data,
            intent: args.intent,
            columns,
            dataShapeHints: args.dataShapeHints,
            forcePattern: args.pattern,
            geoLevel: args.geoLevel,
            geoRegion: args.geoRegion,
        };
        const result = selectPatterns(input);
        const alternatives = result.alternatives.slice(0, maxAlternativeChartTypes);
        const colorPrefs = (args.palette || args.highlight || args.colorField)
            ? { palette: args.palette, highlight: args.highlight, colorField: args.colorField }
            : undefined;
        if (colorPrefs) {
            const colorResult = applyColorPreferences(result.recommended.spec, colorPrefs, data);
            notes.push(...colorResult.notes);
        }
        const spec = result.recommended.spec;
        if (args.title)
            spec.title = args.title;
        if (args.subtitle)
            spec.config = { ...spec.config, subtitle: args.subtitle };
        const hasHtmlBuilder = spec && isHtmlPatternSupported(spec.pattern);
        let outputHtml;
        let finalSpec = spec;
        if (hasHtmlBuilder && shouldCompound(spec, { compound: args.includeDataTable })) {
            const compoundSpec = buildCompoundSpec(spec, columns);
            outputHtml = buildCompoundHtml(compoundSpec);
            finalSpec = compoundSpec;
        }
        else if (hasHtmlBuilder) {
            outputHtml = buildChartHtml(spec);
        }
        const alternativesMap = new Map();
        for (const alt of alternatives) {
            alternativesMap.set(alt.pattern, alt.spec);
        }
        const specId = specStore.save(finalSpec, columns, alternativesMap, data);
        // Write HTML to disk
        let writeResult;
        if (outputHtml) {
            try {
                mkdirSync(dirname(args.writeTo), { recursive: true });
                writeFileSync(args.writeTo, outputHtml, 'utf-8');
                writeResult = `Wrote ${outputHtml.length} bytes to ${args.writeTo}`;
            }
            catch (err) {
                return errorResponse(`Failed to write to ${args.writeTo}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        else {
            writeResult = `No HTML builder for pattern "${spec.pattern}"`;
        }
        const compactResponse = {
            specId,
            writeTo: args.writeTo,
            writeResult,
            ...(notes.length > 0 ? { notes } : {}),
            recommended: {
                pattern: result.recommended.pattern,
                title: spec.title,
                reasoning: result.recommended.reasoning,
            },
            alternatives: alternatives.map(a => ({
                pattern: a.pattern,
                reasoning: a.reasoning,
            })),
            dataShape: {
                rowCount: data.length,
                columnCount: columns.length,
                ...(queryMeta?.truncated ? { truncated: true, totalSourceRows: queryMeta.totalSourceRows } : {}),
            },
        };
        if (isCompoundSpec(finalSpec)) {
            compactResponse.compound = true;
        }
        // CLI tools NEVER return structuredContent - just text
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(compactResponse, null, 2),
                }],
        };
    };
}
//# sourceMappingURL=visualize-cli.js.map