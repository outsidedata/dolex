/**
 * MCP Tool: visualize
 * Takes data (inline, cached, or from a loaded CSV via SQL) + intent
 * and returns visualization recommendations from the handcrafted pattern library.
 *
 * Returns compact text content (specId + metadata, no data) while
 * structuredContent still gets the full pre-rendered chart HTML.
 */

import { z } from 'zod';
import type { VisualizeInput, VisualizeOutput, DataColumn, VisualizationSpec } from '../../types.js';
import { isCompoundSpec } from '../../types.js';
import { ALL_PALETTE_NAMES } from './sql-schemas.js';
import { isHtmlPatternSupported } from '../../renderers/html/index.js';
import { shouldCompound, buildCompoundSpec } from '../../renderers/html/compound.js';
import { specStore } from '../spec-store.js';
import { getResult } from './result-cache.js';
import {
  errorResponse, inferColumns, applyColorPreferences, buildOutputHtml,
  resolveData, isErrorResponse,
} from './shared.js';
import { logOperation } from './operation-log.js';
import type { OperationMeta } from './operation-log.js';

export const columnsSchema = z.array(z.object({
  name: z.string(),
  type: z.enum(['numeric', 'categorical', 'date', 'id', 'text']),
  sampleValues: z.array(z.string()).optional(),
  uniqueCount: z.number().optional(),
  nullCount: z.number().optional(),
  totalCount: z.number().optional(),
})).optional().describe('Column metadata — if not provided, will be inferred from data');

export const dataShapeHintsSchema = z.object({
  rowCount: z.number().optional(),
  categoryCount: z.number().optional(),
  seriesCount: z.number().optional(),
  numericColumnCount: z.number().optional(),
  categoricalColumnCount: z.number().optional(),
  dateColumnCount: z.number().optional(),
  hasTimeSeries: z.boolean().optional(),
  hasHierarchy: z.boolean().optional(),
  hasNegativeValues: z.boolean().optional(),
}).optional().describe('Hints about the data shape to help pattern selection');

export const visualizeInputSchema = z.object({
  data: z.array(z.record(z.any())).optional().describe('Array of data rows to visualize. Optional if resultId or sourceId+sql is provided.'),
  resultId: z.string().optional().describe('Result ID from a previous query_data call — reuses cached data without re-sending it'),
  sourceId: z.string().optional().describe('Dataset ID returned by load_csv — use with sql to query server-side (saves tokens)'),
  sql: z.string().optional().describe('SQL SELECT query to slice/aggregate the data before visualizing. Use table and column names from load_csv/describe_data.'),
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

/**
 * Shared core logic for all visualize data paths (inline, cached, source query).
 * Takes resolved data + args and returns the MCP response.
 */
export function handleVisualizeCore(
  selectPatterns: (input: VisualizeInput) => VisualizeOutput,
  toolName: string = 'visualize',
) {
  return (data: Record<string, any>[], args: {
    intent: string;
    columns?: z.infer<typeof columnsSchema>;
    dataShapeHints?: z.infer<typeof dataShapeHintsSchema>;
    pattern?: string;
    title?: string;
    subtitle?: string;
    includeDataTable?: boolean;
    palette?: string;
    highlight?: { values: any[]; color?: string | string[]; mutedColor?: string; mutedOpacity?: number };
    colorField?: string;
    maxAlternativeChartTypes?: number;
    geoLevel?: 'country' | 'subdivision';
    geoRegion?: string;
  }, queryMeta?: { truncated?: boolean; totalSourceRows?: number }, extraMeta?: Partial<OperationMeta>) => {
    const start = Date.now();
    const notes: string[] = [];
    const columns = (args.columns as DataColumn[]) || inferColumns(data);
    const maxAlternativeChartTypes = args.maxAlternativeChartTypes ?? 2;

    const input: VisualizeInput = {
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
    if (args.title) spec.title = args.title;
    if (args.subtitle) spec.config = { ...spec.config, subtitle: args.subtitle };

    let finalSpec: VisualizationSpec | import('../../types.js').CompoundVisualizationSpec = spec;
    if (isHtmlPatternSupported(spec.pattern) && shouldCompound(spec, { compound: args.includeDataTable })) {
      finalSpec = buildCompoundSpec(spec, columns);
    }
    const outputHtml = buildOutputHtml(finalSpec);

    const alternativesMap = new Map<string, VisualizationSpec>();
    for (const alt of alternatives) {
      alternativesMap.set(alt.pattern, alt.spec);
    }
    const specId = specStore.save(finalSpec, columns, alternativesMap, data);

    const compactResponse: Record<string, any> = {
      specId,
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
        columns: columns.map(c => ({ name: c.name, type: c.type })),
        ...(queryMeta?.truncated ? { truncated: true, totalSourceRows: queryMeta.totalSourceRows } : {}),
      },
    };

    if (isCompoundSpec(finalSpec)) {
      compactResponse.compound = true;
    }

    if (['choropleth', 'proportional-symbol'].includes(spec.pattern) && spec.config) {
      compactResponse.geo = {
        ...(spec.config.mapType ? { region: spec.config.mapType } : {}),
        ...(spec.config.projection ? { projection: spec.config.projection } : {}),
        ...(spec.config.objectName ? { mapFile: spec.config.objectName } : {}),
      };
    }

    logOperation({
      toolName,
      timestamp: start,
      durationMs: Date.now() - start,
      success: true,
      meta: {
        pattern: result.recommended.pattern,
        specId,
        alternativesCount: alternatives.length,
        dataShape: {
          rowCount: data.length,
          columnCount: columns.length,
          columns: columns.map(c => ({ name: c.name, type: c.type })),
        },
        ...extraMeta,
      },
    });

    // Always include HTML — Desktop requires it for inline chart rendering
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(compactResponse, null, 2),
      }],
      ...(outputHtml ? {
        structuredContent: {
          specId,
          html: outputHtml,
        },
      } : {}),
    };
  };
}

export function handleVisualize(
  selectPatterns: (input: VisualizeInput) => VisualizeOutput,
  deps?: { sourceManager?: any },
) {
  const core = handleVisualizeCore(selectPatterns);

  return async (args: z.infer<typeof visualizeInputSchema>) => {
    const resolved = await resolveData(args, { sourceManager: deps?.sourceManager, getResult });
    if (isErrorResponse(resolved)) {
      if (args.sourceId && args.sql) {
        logOperation({
          toolName: 'visualize',
          timestamp: Date.now(),
          durationMs: 0,
          success: false,
          meta: { sqlPreview: args.sql.slice(0, 200), error: 'Data resolution failed' },
        });
      }
      return resolved;
    }

    return core(resolved.data, args, resolved.queryMeta, resolved.extraMeta);
  };
}
