/**
 * MCP Tool: promote_columns
 *
 * Promotes working columns to derived (persisted in .dolex.json manifest).
 */
import type { z } from 'zod';
import { errorResponse, jsonResponse } from './shared.js';
import type { promoteColumnsSchema } from './transform-schemas.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { writeManifest, resolveManifestPath } from '../../transforms/manifest.js';
import type { CsvSourceConfig } from '../../types.js';

export function handlePromoteColumns(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof promoteColumnsSchema>) => {
    const connResult = await deps.sourceManager.connect(args.sourceId);
    if (!connResult.ok) {
      return errorResponse(`Source not found: ${args.sourceId}`);
    }

    const source = connResult.source!;
    const db = source.getDatabase?.();
    if (!db) {
      return errorResponse('Source does not support transforms (no database handle)');
    }

    const schema = await source.getSchema();
    const table = schema.tables.find((t: any) => t.name === args.table);
    if (!table) {
      const available = schema.tables.map((t: any) => t.name);
      return errorResponse(`Table '${args.table}' not found. Available: [${available.join(', ')}]`);
    }

    const metadata = new TransformMetadata(db);
    metadata.init();

    // Resolve columns to promote
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

    // Pre-validate all columns before promoting any (atomic: all-or-nothing)
    for (const col of columnsToPromote) {
      const record = metadata.get(args.table, col);
      if (!record) {
        return errorResponse(`Column '${col}' not found in transforms. Only working columns can be promoted.`);
      }
      if (record.layer !== 'working') {
        return errorResponse(`Column '${col}' is already in '${record.layer}' layer. Only working columns can be promoted.`);
      }
    }

    // Execute promotions
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

    // Write manifest
    const entry = deps.sourceManager.get(args.sourceId);
    if (entry?.config) {
      const manifestPath = resolveManifestPath(entry.config as CsvSourceConfig);
      const tableNames = schema.tables.map((t: any) => t.name);
      writeManifest(metadata, tableNames, manifestPath);
    }

    const workingRemaining = metadata.list(args.table, 'working').length;
    const derivedTotal = metadata.list(args.table, 'derived').length;

    return jsonResponse({
      promoted,
      overwrote_existing: overwroteExisting,
      working_remaining: workingRemaining,
      derived_total: derivedTotal,
    });
  };
}
