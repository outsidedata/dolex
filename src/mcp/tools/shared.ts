/**
 * Shared utilities for MCP tool handlers.
 *
 * Consolidates duplicated logic:
 * - MCP response builders (error/success/html patterns)
 * - Column inference from data rows
 * - Color preference application to visualization specs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type {
  DataColumn,
  VisualizationSpec,
  CompoundVisualizationSpec,
  ColorPaletteName,
} from '../../types.js';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';

// ─── MCP RESPONSE BUILDERS ─────────────────────────────────────────────────

type McpTextContent = { type: 'text'; text: string };

export interface McpResponse {
  [key: string]: unknown;
  content: McpTextContent[];
  isError?: boolean;
  structuredContent?: { specId?: string; html: string };
}

export function errorResponse(message: string): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function jsonResponse(body: unknown): McpResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
  };
}

export function htmlResponse(body: unknown, html: string): McpResponse {
  const specId = (body as Record<string, unknown>)?.specId as string | undefined;
  return {
    content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
    structuredContent: { ...(specId ? { specId } : {}), html },
  };
}

// ─── COLUMN INFERENCE ───────────────────────────────────────────────────────

export function inferColumns(data: Record<string, any>[]): DataColumn[] {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map(key => {
    const values = data.map(r => r[key]).filter(v => v != null);
    const stringValues = values.map(String);
    const uniqueValues = [...new Set(stringValues)];
    const numericCount = values.filter(v =>
      typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v !== '')
    ).length;
    const isNumeric = numericCount > values.length * 0.7;
    const isDate = /date|time|year|month|day/i.test(key) ||
      values.every(v => /^\d{4}[-/]/.test(String(v))) ||
      (values.length > 0 && values.every(v => /^\d{4}-(?:Q\d|W\d{2}|\d{2}(?:-\d{2})?)$/.test(String(v))));
    const isId = /^id$|_id$|Id$/i.test(key) && uniqueValues.length > data.length * 0.5;

    const YEAR_NAME_PATTERN = /\byear\b|\bcohort\b|\bfiscal\b|\bfy\b|\bsemester\b|\bvintage\b|\bclass_of\b|\bgraduating\b|\bperiod\b|\bseason\b/i;

    const looksLikeYear = isNumeric &&
      !isDate &&
      YEAR_NAME_PATTERN.test(key) &&
      values.length > 0 &&
      values.every(v => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1900 && n <= 2100;
      }) &&
      uniqueValues.length <= 50 &&
      uniqueValues.length > 1 &&
      (Math.max(...values.map(Number)) - Math.min(...values.map(Number))) < 200;

    let type: DataColumn['type'] = 'categorical';
    if (isId) type = 'id';
    else if (isDate || looksLikeYear) type = 'date';
    else if (isNumeric) type = 'numeric';

    return {
      name: key,
      type,
      sampleValues: uniqueValues.slice(0, 20),
      uniqueCount: uniqueValues.length,
      nullCount: data.length - values.length,
      totalCount: data.length,
    };
  });
}

// ─── COLOR PREFERENCES ─────────────────────────────────────────────────────

export function applyColorPreferences(
  spec: VisualizationSpec,
  prefs?: { palette?: string; highlight?: { values: any[]; color?: string | string[]; mutedColor?: string; mutedOpacity?: number }; colorField?: string },
  data?: Record<string, any>[],
): { notes: string[] } {
  const notes: string[] = [];
  if (!prefs) return { notes };
  if (!spec.encoding.color) spec.encoding.color = {};

  if (prefs.palette) {
    spec.encoding.color.palette = prefs.palette as ColorPaletteName;
  }
  if (prefs.highlight) {
    spec.encoding.color.highlight = {
      values: prefs.highlight.values,
      ...(prefs.highlight.color != null ? { color: prefs.highlight.color } : {}),
      ...(prefs.highlight.mutedColor != null ? { mutedColor: prefs.highlight.mutedColor } : {}),
      ...(prefs.highlight.mutedOpacity != null ? { mutedOpacity: prefs.highlight.mutedOpacity } : {}),
    };
  }
  if (prefs.colorField) {
    spec.encoding.color.field = prefs.colorField;
    if (!spec.encoding.color.type) spec.encoding.color.type = 'nominal';
  }

  // Auto-infer color field if palette or highlight was set but no field exists
  if ((prefs.palette || prefs.highlight) && !spec.encoding.color?.field) {
    let inferred: string | null = null;

    // Strategy 1: use nominal axis
    if (spec.encoding.x?.type === 'nominal') inferred = spec.encoding.x.field;
    else if (spec.encoding.y?.type === 'nominal') inferred = spec.encoding.y.field;

    // Strategy 2: find a suitable categorical column from data
    if (!inferred && data && data.length > 0) {
      const keys = Object.keys(data[0]);
      for (const key of keys) {
        if (/^id$|_id$|Id$/i.test(key)) continue;
        const vals = data.map(d => d[key]).filter(v => v != null);
        const isNum = vals.every(v => typeof v === 'number' || !isNaN(Number(v)));
        if (isNum) continue;
        const unique = new Set(vals.map(String));
        if (unique.size <= 20) {
          inferred = key;
          break;
        }
      }
    }

    if (inferred) {
      spec.encoding.color!.field = inferred;
      if (!spec.encoding.color!.type) spec.encoding.color!.type = 'nominal';
      notes.push(`Color field auto-detected as '${inferred}'. Use colorField to override.`);
    } else if (prefs.palette) {
      notes.push(`Palette '${prefs.palette}' ignored — no categorical column found with ≤20 unique values. Use colorField to specify.`);
    }
  }

  // Validate highlight values against data
  if (prefs.highlight && spec.encoding.color?.field && data) {
    const field = spec.encoding.color.field;
    const dataValues = new Set(data.map(d => String(d[field]).toLowerCase()));
    const unmatched = prefs.highlight.values.filter(
      (v: any) => !dataValues.has(String(v).toLowerCase())
    );
    if (unmatched.length > 0) {
      notes.push(`Highlight: ${unmatched.map((v: any) => `'${v}'`).join(', ')} not found in data for field '${field}'.`);
    }
  }

  return { notes };
}

// ─── HTML BUILDING ──────────────────────────────────────────────────────────

export function buildOutputHtml(spec: VisualizationSpec | CompoundVisualizationSpec): string | undefined {
  if (isCompoundSpec(spec)) {
    return buildCompoundHtml(spec);
  }
  if (isHtmlPatternSupported(spec.pattern)) {
    return buildChartHtml(spec);
  }
  return undefined;
}

export function writeHtmlToDisk(html: string, writeTo: string): { ok: true; message: string } | { ok: false; error: string } {
  try {
    mkdirSync(dirname(writeTo), { recursive: true });
    writeFileSync(writeTo, html, 'utf-8');
    return { ok: true, message: `Wrote ${html.length} bytes to ${writeTo}` };
  } catch (err) {
    return { ok: false, error: `Failed to write to ${writeTo}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ─── FORMATTING ─────────────────────────────────────────────────────────────

export function formatUptime(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} minutes`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ─── DATA RESOLUTION ────────────────────────────────────────────────────────

export interface ResolvedData {
  data: Record<string, any>[];
  queryMeta?: { truncated?: boolean; totalSourceRows?: number };
  extraMeta?: { sqlPreview?: string; sourceType?: string };
}

/**
 * Resolves data from one of three sources: sourceId+sql, resultId, or inline data.
 * Returns the resolved data or an error response.
 */
export async function resolveData(
  args: { data?: Record<string, any>[]; resultId?: string; sourceId?: string; sql?: string },
  deps: { sourceManager?: any; getResult: (id: string) => { rows: Record<string, any>[]; columns: { name: string; type: string }[] } | null },
): Promise<ResolvedData | McpResponse> {
  let data = args.data;
  let queryMeta: ResolvedData['queryMeta'];
  let extraMeta: ResolvedData['extraMeta'];

  if (args.sourceId && args.sql) {
    if (!deps.sourceManager) {
      return errorResponse('Source manager not available.');
    }
    const source = deps.sourceManager.get?.(args.sourceId);
    const sourceType = source?.type;

    const result = await deps.sourceManager.querySql(args.sourceId, args.sql);
    if (!result.ok) {
      return errorResponse(result.error);
    }
    data = result.rows;
    queryMeta = { truncated: result.truncated, totalSourceRows: result.totalRows };
    extraMeta = { sqlPreview: args.sql.slice(0, 200), sourceType };
  }

  if (!data && args.resultId) {
    const cached = deps.getResult(args.resultId);
    if (!cached) {
      return errorResponse(`Result "${args.resultId}" not found or expired. Re-run query_data to get a new resultId.`);
    }
    data = cached.rows;
  }

  if (!data || data.length === 0) {
    return errorResponse('No data provided. Pass data array, resultId from query_data, or sourceId + sql.');
  }

  return { data, queryMeta, extraMeta };
}

/** Type guard: checks if a resolveData result is an error response. */
export function isErrorResponse(result: ResolvedData | McpResponse): result is McpResponse {
  return 'content' in result && 'isError' in result;
}

// ─── TRANSFORM TOOL HELPERS ─────────────────────────────────────────────────

export interface TransformContext {
  source: any;
  db: any;
  table: any;
}

/**
 * Shared setup for all transform tools: connect to source, get database handle,
 * validate table exists. Returns either the context or an error response.
 */
export async function connectAndValidateTable(
  deps: { sourceManager: any },
  sourceId: string,
  tableName: string,
): Promise<TransformContext | McpResponse> {
  const connResult = await deps.sourceManager.connect(sourceId);
  if (!connResult.ok) {
    return errorResponse(`Source not found: ${sourceId}`);
  }

  const source = connResult.source!;
  const db = source.getDatabase?.();
  if (!db) {
    return errorResponse('Source does not support transforms (no database handle)');
  }

  const schema = await source.getSchema();
  const table = schema.tables.find((t: any) => t.name === tableName);
  if (!table) {
    const available = schema.tables.map((t: any) => t.name);
    return errorResponse(`Table '${tableName}' not found. Available: [${available.join(', ')}]`);
  }

  return { source, db, table };
}

/** Type guard: checks if a connectAndValidateTable result is an error response. */
export function isTransformError(result: TransformContext | McpResponse): result is McpResponse {
  return 'content' in result;
}

