/**
 * MCP Tools: list_data, load_csv, remove_data, describe_data
 * Manage CSV datasets.
 */

import { z } from 'zod';
import { errorResponse, jsonResponse } from './shared.js';

const SANDBOX_PATH_PATTERNS = [
  /^\/mnt\/user-data\//,
  /^\/home\/claude\//,
  /^\/tmp\/uploads\//,
  /^\/mnt\/uploads\//,
];

export function isSandboxPath(filePath: string): boolean {
  return SANDBOX_PATH_PATTERNS.some(p => p.test(filePath));
}

export const addSourceInputSchema = z.object({
  name: z.string().describe('Name for this dataset'),
  path: z.string().describe('Path to a CSV file or directory of CSV files'),
  detail: z.enum(['compact', 'full']).default('compact').describe('Schema detail level: "compact" (default) returns just column names/types + row counts; "full" includes stats, top values, and sample rows'),
});

export const removeSourceInputSchema = z.object({
  sourceId: z.string().describe('Dataset ID returned by load_csv'),
});

export const describeSourceInputSchema = z.object({
  sourceId: z.string().describe('Dataset ID returned by load_csv'),
  table: z.string().optional().describe('Table name (optional — if omitted, returns all tables)'),
  detail: z.enum(['compact', 'full']).default('full').describe('Schema detail level: "compact" returns just column names/types + row counts; "full" (default) includes stats, top values, and sample rows'),
});

/** Build a table profile from schema table + connected source */
async function buildTableProfile(t: any, connectedSource: any, detail: 'compact' | 'full' = 'full') {
  if (detail === 'compact') {
    return {
      name: t.name,
      rowCount: t.rowCount,
      columns: t.columns.map((c: any) => ({ name: c.name, type: c.type })),
    };
  }
  const sampleRows = connectedSource
    ? await connectedSource.getSampleRows(t.name, 5)
    : [];
  return {
    name: t.name,
    rowCount: t.rowCount,
    columns: t.columns.map((c: any) => ({
      name: c.name,
      type: c.type,
      nullCount: c.nullCount,
      uniqueCount: c.uniqueCount,
      ...(c.stats ? { stats: c.stats } : {}),
      ...(c.topValues ? { topValues: c.topValues } : {}),
      sample: c.sampleValues?.slice(0, 3),
    })),
    sampleRows,
  };
}

export function handleListSources(deps: { sourceManager: any }) {
  return async () => jsonResponse(deps.sourceManager.list());
}

export function handleAddSource(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof addSourceInputSchema>) => {
    if (isSandboxPath(args.path)) {
      return errorResponse(
        'This path looks like a cloud sandbox path, not a local filesystem path. '
        + 'Dolex runs on the user\'s machine and can access any local file — but not cloud sandbox uploads. '
        + 'Ask the user for the real local path (e.g. /Users/name/Downloads/data.csv).'
      );
    }

    const config = { type: 'csv' as const, path: args.path };

    let entry: any;
    let reconnected = false;

    const existing = deps.sourceManager.get(args.name);
    if (existing) {
      entry = existing;
      reconnected = true;
    } else {
      let addResult: any;
      try {
        addResult = await deps.sourceManager.add(args.name, config);
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return errorResponse(
            `File not found: ${args.path}. `
            + 'Ask the user to double-check the path exists on their machine.'
          );
        }
        return errorResponse(err.message);
      }
      if (!addResult.ok || !addResult.entry) {
        return errorResponse(addResult.error ?? 'Failed to load CSV');
      }
      entry = addResult.entry;
    }

    const schemaResult = await deps.sourceManager.getSchema(entry.id);
    const schema = schemaResult.ok ? schemaResult.schema : null;

    const connResult = await deps.sourceManager.connect(entry.id);
    const connectedSource = connResult.ok ? connResult.source : null;

    const tables = await Promise.all(
      (schema?.tables ?? []).map((t: any) => buildTableProfile(t, connectedSource, args.detail))
    );

    const tableCount = schema?.tables.length ?? 0;
    const verb = reconnected ? 'Reconnected' : 'Loaded';

    return jsonResponse({
      sourceId: entry.id,
      name: entry.name,
      tables,
      message: `${verb} "${args.name}" — ${tableCount} tables found`,
    });
  };
}

export function handleRemoveSource(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof removeSourceInputSchema>) => {
    let removeResult: any;
    try {
      removeResult = await deps.sourceManager.remove(args.sourceId);
    } catch (err: any) {
      return errorResponse(err.message);
    }
    if (!removeResult.ok) {
      return errorResponse(removeResult.error ?? 'Failed to remove source');
    }
    return jsonResponse({ message: `Source "${args.sourceId}" removed` });
  };
}

export function handleDescribeSource(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof describeSourceInputSchema>) => {
    const schemaResult = await deps.sourceManager.getSchema(args.sourceId);
    if (!schemaResult.ok || !schemaResult.schema) {
      return errorResponse(schemaResult.error ?? `Source not found: ${args.sourceId}`);
    }

    const connResult = await deps.sourceManager.connect(args.sourceId);
    const connectedSource = connResult.ok ? connResult.source : null;

    let tables = schemaResult.schema.tables;
    if (args.table) {
      tables = tables.filter((t: any) => t.name === args.table);
      if (tables.length === 0) {
        return errorResponse(`Table "${args.table}" not found. Available: ${schemaResult.schema.tables.map((t: any) => t.name).join(', ')}`);
      }
    }

    const profiles = await Promise.all(
      tables.map((t: any) => buildTableProfile(t, connectedSource, args.detail))
    );

    return jsonResponse(args.table ? profiles[0] : profiles);
  };
}
