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
import type { VisualizeInput, VisualizeOutput } from '../../types.js';
import { ALL_PALETTE_NAMES } from './sql-schemas.js';
import { getResult } from './result-cache.js';
import {
  errorResponse, resolveData, isErrorResponse, writeHtmlToDisk,
} from './shared.js';
import { columnsSchema, dataShapeHintsSchema, handleVisualizeCore } from './visualize.js';

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

export function handleVisualizeCli(
  selectPatterns: (input: VisualizeInput) => VisualizeOutput,
  deps?: { sourceManager?: any },
) {
  const core = handleVisualizeCore(selectPatterns, 'visualize_cli_only');

  return async (args: z.infer<typeof visualizeCliInputSchema>) => {
    const resolved = await resolveData(args, { sourceManager: deps?.sourceManager, getResult });
    if (isErrorResponse(resolved)) return resolved;

    const coreResult = core(resolved.data, args, resolved.queryMeta, resolved.extraMeta);

    // Extract the text response body and add write info
    const textContent = coreResult.content.find((c: any) => c.type === 'text');
    if (!textContent) return errorResponse('Unexpected error: no text content from core');
    const body = JSON.parse(textContent.text);

    // Write HTML to disk from structuredContent (if present)
    const html = (coreResult as any).structuredContent?.html;
    if (html) {
      const writeResult = writeHtmlToDisk(html, args.writeTo);
      if (!writeResult.ok) return errorResponse(writeResult.error);
      body.writeTo = args.writeTo;
      body.writeResult = writeResult.message;
    } else {
      body.writeTo = args.writeTo;
      body.writeResult = `No HTML builder for pattern "${body.recommended?.pattern}"`;
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(body, null, 2),
      }],
    };
  };
}
