import { z } from 'zod';
import type {
  VisualizationSpec,
  CompoundVisualizationSpec,
  RefineOutput,
  DataColumn,
} from '../../types.js';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import type { StoredSpec } from '../spec-store.js';
import { errorResponse, htmlResponse } from './shared.js';
import { logOperation } from './operation-log.js';
import { selectPattern } from '../../patterns/selector.js';
import { ALL_PALETTE_NAMES } from './sql-schemas.js';

const FLIPPABLE_PATTERNS = new Set([
  'bar', 'grouped-bar', 'stacked-bar', 'lollipop', 'bullet',
  'line', 'area', 'histogram', 'scatter', 'connected-scatter',
]);

const FLOW_PATTERNS = new Set(['sankey', 'alluvial', 'chord', 'funnel']);

const FORMAT_MAP: Record<string, string> = {
  'percent': '.1%',
  'dollar': '$,.0f',
  'integer': ',.0f',
  'decimal': ',.2f',
  'compact': '.2s',
};

export const refineInputSchema = z.object({
  specId: z.string().describe('Spec ID from a previous visualize or refine call'),

  sort: z.object({
    field: z.string().optional().describe('Column to sort by. If omitted, sorts by primary measure axis.'),
    direction: z.enum(['asc', 'desc']),
  }).nullable().optional(),

  limit: z.number().optional().describe('Top N rows'),

  filter: z.array(z.object({
    field: z.string(),
    op: z.enum(['in', 'not_in', 'gt', 'gte', 'lt', 'lte', '=', '!='])
      .default('in')
      .transform(op => op === '=' ? 'in' as const : op === '!=' ? 'not_in' as const : op),
    values: z.array(z.union([z.string(), z.number()])),
  })).optional().describe('Data filters. Pass empty array [] to clear filters.'),

  flip: z.boolean().optional().describe('Swap x/y axes (Cartesian charts only)'),

  title: z.string().optional(),
  subtitle: z.string().optional(),
  xLabel: z.string().optional().describe('X-axis label'),
  yLabel: z.string().optional().describe('Y-axis label'),

  palette: z.enum(ALL_PALETTE_NAMES).optional()
    .describe('Named palette: categorical, blue, green, purple, warm, blueRed, etc.'),

  highlight: z.object({
    values: z.array(z.union([z.string(), z.number()])).describe('Values to emphasize'),
    color: z.union([z.string(), z.array(z.string())]).optional(),
    mutedColor: z.string().optional(),
    mutedOpacity: z.number().optional(),
  }).nullable().optional()
    .transform(v => v && v.values?.length === 0 ? null : v)
    .describe('Highlight specific values. Pass null to clear.'),

  colorField: z.string().optional().describe('Which data field drives color'),

  flowColorBy: z.enum(['source', 'target']).optional()
    .describe('Color flow charts by source or target node (alluvial, sankey, chord, funnel only)'),

  format: z.enum(['percent', 'dollar', 'integer', 'decimal', 'compact']).optional()
    .describe('Value axis number format'),

  switchPattern: z.string().optional()
    .describe('Switch to a different chart type by pattern ID'),

  removeTable: z.boolean().optional().describe('Remove the data table from a compound chart'),
  layout: z.enum(['rows', 'columns']).optional().describe('Compound layout'),
  hideColumns: z.array(z.string()).optional().describe('Hide columns from the data table'),

  returnHtml: z.boolean().optional()
    .describe('Whether to return pre-rendered HTML in the response. Default: true. Set to false to save tokens.'),
});

type RefineArgs = z.infer<typeof refineInputSchema>;

function applyAtomicParams(
  spec: VisualizationSpec,
  args: RefineArgs,
  stored: StoredSpec,
): RefineOutput {
  const changes: string[] = [];
  const notes: string[] = [];

  if (args.filter !== undefined) {
    if (args.filter.length === 0) {
      if (stored.originalData) {
        spec.data = [...stored.originalData];
        changes.push('Cleared all filters');
      }
    } else {
      for (const f of args.filter) {
        const before = spec.data.length;
        const normalizeStr = (v: any) => String(v).toLowerCase();
        if (f.op === 'in') {
          const valSet = new Set(f.values.map(normalizeStr));
          spec.data = spec.data.filter(d => valSet.has(normalizeStr(d[f.field])));
        } else if (f.op === 'not_in') {
          const valSet = new Set(f.values.map(normalizeStr));
          spec.data = spec.data.filter(d => !valSet.has(normalizeStr(d[f.field])));
        } else {
          const threshold = Number(f.values[0]);
          spec.data = spec.data.filter(d => {
            const v = Number(d[f.field]);
            if (f.op === 'gt') return v > threshold;
            if (f.op === 'gte') return v >= threshold;
            if (f.op === 'lt') return v < threshold;
            if (f.op === 'lte') return v <= threshold;
            return true;
          });
        }
        if (spec.data.length === 0) {
          spec.data = stored.originalData ? [...stored.originalData] : spec.data;
          notes.push(`Filter on '${f.field}' removed all rows — filter was not applied.`);
        } else {
          changes.push(`Filtered ${f.field}: ${before} → ${spec.data.length} rows`);
        }
      }
    }
  }

  if (args.sort !== undefined) {
    if (args.sort === null) {
      delete spec.config.sortBy;
      delete spec.config.sortOrder;
      changes.push('Cleared sort');
    } else {
      const dir = args.sort.direction;
      const sortOrder = dir === 'desc' ? 'descending' : 'ascending';
      if (args.sort.field) {
        const field = args.sort.field;
        if (spec.encoding.y && field === spec.encoding.y.field) {
          spec.config.sortBy = 'value';
        } else if (spec.encoding.x && field === spec.encoding.x.field) {
          spec.config.sortBy = 'category';
        } else {
          const keys = spec.data.length > 0 ? Object.keys(spec.data[0]) : [];
          if (keys.includes(field)) {
            spec.data.sort((a, b) => {
              const av = a[field], bv = b[field];
              if (av == null) return 1;
              if (bv == null) return -1;
              return dir === 'desc'
                ? (typeof av === 'number' ? bv - av : String(bv).localeCompare(String(av)))
                : (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv)));
            });
          } else {
            notes.push(`Sort field '${field}' not found. Available: ${keys.join(', ')}`);
          }
        }
        spec.config.sortOrder = sortOrder;
        changes.push(`Sorted by ${field} ${dir}`);
      } else {
        spec.config.sortBy = 'value';
        spec.config.sortOrder = sortOrder;
        changes.push(`Sorted by value ${dir}`);
      }
    }
  }

  if (args.limit !== undefined) {
    spec.data = spec.data.slice(0, args.limit);
    changes.push(`Limited to top ${args.limit} rows`);
  }

  if (args.colorField !== undefined) {
    if (!spec.encoding.color) spec.encoding.color = {};
    spec.encoding.color.field = args.colorField;
    if (!spec.encoding.color.type) spec.encoding.color.type = 'nominal';
    changes.push(`Set color field to '${args.colorField}'`);
  }

  if (args.palette !== undefined) {
    if (!spec.encoding.color) spec.encoding.color = {};
    spec.encoding.color.palette = args.palette;
    changes.push(`Applied ${args.palette} palette`);
  }

  if (args.highlight !== undefined) {
    if (args.highlight === null) {
      if (spec.encoding.color) {
        delete spec.encoding.color.highlight;
      }
      changes.push('Cleared highlight');
    } else {
      if (!spec.encoding.color) spec.encoding.color = {};
      const colorField = spec.encoding.color.field;
      if (colorField && spec.data.length > 0) {
        const normalize = (v: any) => String(v).trim().toLowerCase();
        const dataVals = new Map<string, string>();
        for (const d of spec.data) {
          const raw = String(d[colorField]);
          dataVals.set(normalize(raw), raw);
        }
        const matched: (string | number)[] = [];
        const unmatched: (string | number)[] = [];
        for (const v of args.highlight.values) {
          const found = dataVals.get(normalize(v));
          if (found !== undefined) {
            matched.push(found);
          } else {
            unmatched.push(v);
          }
        }
        if (unmatched.length > 0) {
          notes.push(`Highlight: ${unmatched.map(v => `'${v}'`).join(', ')} not found in '${colorField}'.`);
        }
        if (matched.length > 0) {
          spec.encoding.color.highlight = {
            values: matched,
            ...(args.highlight.color != null ? { color: args.highlight.color } : {}),
            ...(args.highlight.mutedColor != null ? { mutedColor: args.highlight.mutedColor } : {}),
            ...(args.highlight.mutedOpacity != null ? { mutedOpacity: args.highlight.mutedOpacity } : {}),
          };
          changes.push(`Highlighted: ${matched.join(', ')}`);
        }
      } else {
        spec.encoding.color.highlight = {
          values: args.highlight.values,
          ...(args.highlight.color != null ? { color: args.highlight.color } : {}),
          ...(args.highlight.mutedColor != null ? { mutedColor: args.highlight.mutedColor } : {}),
          ...(args.highlight.mutedOpacity != null ? { mutedOpacity: args.highlight.mutedOpacity } : {}),
        };
        changes.push(`Highlighted: ${args.highlight.values.join(', ')}`);
      }
    }
  }

  if (args.flip === true) {
    if (FLIPPABLE_PATTERNS.has(spec.pattern)) {
      const { x, y } = spec.encoding;
      if (x && y) {
        spec.encoding.x = y;
        spec.encoding.y = x;
        changes.push('Flipped axes');
      }
    } else {
      notes.push(`Flip ignored — ${spec.pattern} charts don't have swappable axes.`);
    }
  }

  if (args.title !== undefined) {
    spec.title = args.title;
    changes.push(`Title: "${args.title}"`);
  }
  if (args.subtitle !== undefined) {
    spec.config.subtitle = args.subtitle;
    changes.push(`Subtitle: "${args.subtitle}"`);
  }
  if (args.xLabel !== undefined) {
    if (spec.encoding.x) spec.encoding.x.title = args.xLabel;
    changes.push(`X-axis label: "${args.xLabel}"`);
  }
  if (args.yLabel !== undefined) {
    if (spec.encoding.y) spec.encoding.y.title = args.yLabel;
    changes.push(`Y-axis label: "${args.yLabel}"`);
  }

  if (args.format !== undefined) {
    const fmt = FORMAT_MAP[args.format];
    if (fmt) {
      if (spec.pattern === 'heatmap') {
        if (!spec.encoding.color) spec.encoding.color = {};
        (spec.encoding.color as any).format = fmt;
      } else if (spec.encoding.y) {
        spec.encoding.y.format = fmt;
      }
      changes.push(`Applied ${args.format} format`);
    }
  }

  if (args.flowColorBy !== undefined) {
    if (FLOW_PATTERNS.has(spec.pattern)) {
      spec.config.colorBy = args.flowColorBy;
      changes.push(`Set flow colorBy to '${args.flowColorBy}'`);
    } else {
      notes.push(`flowColorBy ignored — only applies to flow patterns (sankey, alluvial, chord, funnel).`);
    }
  }

  return { spec, changes, notes };
}

function applyCompoundParams(
  spec: CompoundVisualizationSpec,
  args: RefineArgs,
  stored: StoredSpec,
): RefineOutput {
  const changes: string[] = [];
  const notes: string[] = [];

  if (args.removeTable === true) {
    const chartView = spec.views.find(v => v.type === 'chart');
    if (chartView?.chart) {
      const atomicSpec: VisualizationSpec = {
        ...chartView.chart,
        data: spec.data,
      } as VisualizationSpec;
      const subResult = applyAtomicParams(atomicSpec, { ...args, removeTable: undefined }, stored);
      return {
        spec: subResult.spec,
        changes: ['Removed table, returned atomic chart', ...subResult.changes],
        notes: subResult.notes,
      };
    }
  }

  if (args.layout !== undefined) {
    spec.layout.type = args.layout;
    changes.push(`Layout: ${args.layout}`);
  }

  if (args.hideColumns !== undefined && args.hideColumns.length > 0) {
    const tableView = spec.views.find(v => v.type === 'table');
    if (tableView?.table?.columns) {
      const hideSet = new Set(args.hideColumns.map(c => c.toLowerCase()));
      tableView.table.columns = tableView.table.columns.filter(
        c => !hideSet.has(c.field.toLowerCase()) && !hideSet.has((c.title || '').toLowerCase())
      );
      changes.push(`Hidden columns: ${args.hideColumns.join(', ')}`);
    }
  }

  if (args.title !== undefined) {
    spec.title = args.title;
    const chartView = spec.views.find(v => v.type === 'chart');
    if (chartView?.chart) chartView.chart.title = args.title;
    changes.push(`Title: "${args.title}"`);
  }

  const chartView = spec.views.find(v => v.type === 'chart');
  if (chartView?.chart) {
    const chartSpec: VisualizationSpec = {
      ...chartView.chart,
      data: spec.data,
    } as VisualizationSpec;
    const atomicArgs = { ...args, removeTable: undefined, layout: undefined, hideColumns: undefined, title: undefined };
    const hasAtomicArgs = atomicArgs.sort !== undefined || atomicArgs.limit !== undefined ||
      atomicArgs.filter !== undefined || atomicArgs.flip !== undefined ||
      atomicArgs.palette !== undefined || atomicArgs.highlight !== undefined ||
      atomicArgs.colorField !== undefined || atomicArgs.format !== undefined ||
      atomicArgs.flowColorBy !== undefined || atomicArgs.subtitle !== undefined ||
      atomicArgs.xLabel !== undefined || atomicArgs.yLabel !== undefined;

    if (hasAtomicArgs) {
      const subResult = applyAtomicParams(chartSpec, atomicArgs, stored);
      const refinedChart = subResult.spec as VisualizationSpec;
      chartView.chart = {
        pattern: refinedChart.pattern,
        title: refinedChart.title,
        encoding: refinedChart.encoding,
        config: refinedChart.config,
      };
      spec.data = refinedChart.data;
      changes.push(...subResult.changes);
      notes.push(...subResult.notes);
    }
  }

  return { spec, changes, notes };
}

function buildOutputHtml(spec: VisualizationSpec | CompoundVisualizationSpec): string | undefined {
  if (isCompoundSpec(spec)) {
    return buildCompoundHtml(spec);
  }
  if (isHtmlPatternSupported(spec.pattern)) {
    return buildChartHtml(spec);
  }
  return undefined;
}

export function handleRefine() {
  return async (args: RefineArgs) => {
    const start = Date.now();
    const switchNotes: string[] = [];

    const stored = specStore.get(args.specId);
    if (!stored) {
      return errorResponse(`Spec "${args.specId}" not found. It may have expired. Re-run visualize to get a new specId.`);
    }

    let spec = JSON.parse(JSON.stringify(stored.spec)) as VisualizationSpec | CompoundVisualizationSpec;

    if (args.switchPattern) {
      const altSpec = stored.alternatives.get(args.switchPattern);
      if (altSpec) {
        spec = JSON.parse(JSON.stringify(altSpec)) as VisualizationSpec;
      } else {
        try {
          const data = isCompoundSpec(spec)
            ? (spec as CompoundVisualizationSpec).data
            : (spec as VisualizationSpec).data;
          const result = selectPattern(data, stored.columns, '', { forcePattern: args.switchPattern });
          spec = result.recommended.spec;
          for (const alt of result.alternatives) {
            stored.alternatives.set(alt.pattern.id, alt.spec);
          }
        } catch {
          switchNotes.push(`Pattern '${args.switchPattern}' cannot render this data shape. Available: ${[...stored.alternatives.keys()].join(', ')}`);
        }
      }
    }

    let result: RefineOutput;
    if (isCompoundSpec(spec)) {
      result = applyCompoundParams(spec as CompoundVisualizationSpec, args, stored);
    } else {
      result = applyAtomicParams(spec as VisualizationSpec, args, stored);
    }

    if (args.switchPattern && !switchNotes.length) {
      result.changes.unshift(`Switched to ${args.switchPattern}`);
    }
    result.notes.push(...switchNotes);

    const outputHtml = buildOutputHtml(result.spec);
    const newSpecId = specStore.updateSpec(args.specId, result.spec);

    const body: Record<string, any> = {
      specId: newSpecId,
      changes: result.changes,
      alternatives: [...stored.alternatives.keys()],
    };
    if (result.notes.length > 0) {
      body.notes = result.notes;
    }

    const pattern = isCompoundSpec(result.spec)
      ? (result.spec as any).views?.find((v: any) => v.type === 'chart')?.chart?.pattern
      : (result.spec as VisualizationSpec).pattern;
    logOperation({
      toolName: 'refine_visualization',
      timestamp: start,
      durationMs: Date.now() - start,
      success: true,
      meta: {
        pattern,
        specId: newSpecId,
        changes: result.changes,
      },
    });

    const shouldReturnHtml = args.returnHtml !== false;
    if (outputHtml && shouldReturnHtml) {
      return htmlResponse(body, outputHtml);
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(body, null, 2) }] };
  };
}
