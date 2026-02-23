/**
 * MCP Tool: drop_columns
 *
 * Drops derived or working columns. Handles dependency validation,
 * shadow restoration, and manifest updates.
 */
import type { z } from 'zod';
import { jsonResponse, errorResponse } from './shared.js';
import type { dropColumnsSchema } from './transform-schemas.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { ColumnManager } from '../../transforms/column-manager.js';
import { findDependents } from '../../transforms/dependency.js';
import { evaluateExpression } from '../../transforms/evaluator.js';
import { writeManifest, resolveManifestPath } from '../../transforms/manifest.js';
import type { CsvSourceConfig } from '../../types.js';

export function handleDropColumns(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof dropColumnsSchema>) => {
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
    const mgr = new ColumnManager(db);

    const columnsToDrop = resolveWildcard(args.columns, args.layer, metadata, args.table);
    if (typeof columnsToDrop === 'string') {
      return errorResponse(columnsToDrop);
    }

    // Pre-validate all columns (atomic: all-or-nothing)
    const allCols = mgr.getColumnNames(args.table);
    for (const col of columnsToDrop) {
      const record = metadata.get(args.table, col);
      if (!record) {
        if (allCols.includes(col)) {
          return errorResponse(`Column '${col}' is a source column and cannot be dropped`);
        }
        return errorResponse(`Column '${col}' not found`);
      }
      const targetLayer = args.layer ?? record.layer;
      if (targetLayer === 'derived') {
        const allRecords = metadata.list(args.table);
        const dependents = findDependents(col, allRecords);
        if (dependents.length > 0) {
          return errorResponse(
            `Cannot drop derived column '${col}': columns [${dependents.join(', ')}] depend on it. Drop them first.`
          );
        }
      }
    }

    const dropped: string[] = [];
    const restored: string[] = [];
    let manifestUpdated = false;

    for (const col of columnsToDrop) {
      const record = metadata.get(args.table, col)!;
      const targetLayer = args.layer ?? record.layer;

      if (targetLayer === 'derived') {
        metadata.remove(args.table, col, 'derived');
        if (!metadata.exists(args.table, col)) {
          mgr.dropColumn(args.table, col);
        }
        dropped.push(col);
        manifestUpdated = true;
      } else {
        const hasDerived = metadata.hasDerived(args.table, col);
        metadata.remove(args.table, col, 'working');

        if (hasDerived) {
          const derivedRecord = metadata.getDerived(args.table, col)!;
          try {
            const rows = mgr.getAllRows(args.table);
            const result = evaluateExpression(derivedRecord.expr, rows, {
              partitionBy: derivedRecord.partitionBy,
            });
            mgr.overwriteColumn(args.table, col, result.values);
            restored.push(col);
          } catch {
            metadata.remove(args.table, col, 'derived');
            mgr.dropColumn(args.table, col);
            manifestUpdated = true;
          }
        } else {
          mgr.dropColumn(args.table, col);
        }
        dropped.push(col);
      }
    }

    if (manifestUpdated) {
      const entry = deps.sourceManager.get(args.sourceId);
      if (entry?.config) {
        const schema = await source.getSchema();
        const manifestPath = resolveManifestPath(entry.config as CsvSourceConfig);
        const tableNames = schema.tables.map((t: any) => t.name);
        writeManifest(metadata, tableNames, manifestPath);
      }
    }

    source.invalidateSchema?.();

    return jsonResponse({
      dropped,
      restored,
      working_remaining: metadata.list(args.table, 'working').length,
      derived_remaining: metadata.list(args.table, 'derived').length,
    });
  };
}

/**
 * Resolves ["*"] to all column names in the specified layer.
 * Returns an error message string on failure.
 */
function resolveWildcard(
  columns: string[],
  layer: string | undefined,
  metadata: TransformMetadata,
  table: string,
): string[] | string {
  if (columns.length !== 1 || columns[0] !== '*') return columns;

  if (!layer) {
    return 'When using ["*"], you must specify a layer (derived or working)';
  }
  const resolved = metadata.list(table, layer as 'derived' | 'working').map(r => r.column);
  if (resolved.length === 0) return `No ${layer} columns to drop`;
  return resolved;
}
