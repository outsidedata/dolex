/**
 * MCP Tool: promote_columns
 *
 * Promotes working columns to derived (persisted in .dolex.json manifest).
 */
import type { z } from 'zod';
import { errorResponse, jsonResponse, connectAndValidateTable, isTransformError } from './shared.js';
import type { promoteColumnsSchema } from './transform-schemas.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { writeManifest, resolveManifestPath } from '../../transforms/manifest.js';
import type { CsvSourceConfig } from '../../types.js';

export function handlePromoteColumns(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof promoteColumnsSchema>) => {
    const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
    if (isTransformError(ctx)) return ctx;

    const metadata = new TransformMetadata(ctx.db);
    metadata.init();

    let columnsToPromote: string[];
    if (args.columns.length === 1 && args.columns[0] === '*') {
      const working = metadata.list(args.table, 'working');
      columnsToPromote = working.map(r => r.column);
      if (columnsToPromote.length === 0) {
        return errorResponse('No working columns to promote');
      }
    } else {
      columnsToPromote = args.columns;
    }

    for (const col of columnsToPromote) {
      const record = metadata.get(args.table, col);
      if (!record) {
        return errorResponse(`Column '${col}' not found in transforms. Only working columns can be promoted.`);
      }
      if (record.layer !== 'working') {
        return errorResponse(`Column '${col}' is already in '${record.layer}' layer. Only working columns can be promoted.`);
      }
    }

    const promoted: string[] = [];
    const overwroteExisting: string[] = [];
    for (const col of columnsToPromote) {
      if (metadata.hasDerived(args.table, col)) {
        metadata.remove(args.table, col, 'derived');
        overwroteExisting.push(col);
      }
      metadata.updateLayer(args.table, col, 'working', 'derived');
      promoted.push(col);
    }

    const entry = deps.sourceManager.get(args.sourceId);
    if (entry?.config) {
      const schema = await ctx.source.getSchema();
      const manifestPath = resolveManifestPath(entry.config as CsvSourceConfig);
      const tableNames = schema.tables.map((t: any) => t.name);
      writeManifest(metadata, tableNames, manifestPath);
    }

    return jsonResponse({
      promoted,
      overwrote_existing: overwroteExisting,
      working_remaining: metadata.list(args.table, 'working').length,
      derived_total: metadata.list(args.table, 'derived').length,
    });
  };
}
