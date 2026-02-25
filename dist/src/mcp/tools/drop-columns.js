import { jsonResponse, errorResponse, connectAndValidateTable, isTransformError } from './shared.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { ColumnManager } from '../../transforms/column-manager.js';
import { findDependents } from '../../transforms/dependency.js';
import { evaluateExpression } from '../../transforms/evaluator.js';
import { writeManifest, resolveManifestPath } from '../../transforms/manifest.js';
export function handleDropColumns(deps) {
    return async (args) => {
        const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
        if (isTransformError(ctx))
            return ctx;
        const metadata = new TransformMetadata(ctx.db);
        metadata.init();
        const mgr = new ColumnManager(ctx.db);
        const columnsToDrop = resolveWildcard(args.columns, args.layer, metadata, args.table);
        if (typeof columnsToDrop === 'string') {
            return errorResponse(columnsToDrop);
        }
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
                    return errorResponse(`Cannot drop derived column '${col}': columns [${dependents.join(', ')}] depend on it. Drop them first.`);
                }
            }
        }
        const dropped = [];
        const restored = [];
        let manifestUpdated = false;
        for (const col of columnsToDrop) {
            const record = metadata.get(args.table, col);
            const targetLayer = args.layer ?? record.layer;
            if (targetLayer === 'derived') {
                metadata.remove(args.table, col, 'derived');
                if (!metadata.exists(args.table, col)) {
                    mgr.dropColumn(args.table, col);
                }
                dropped.push(col);
                manifestUpdated = true;
            }
            else {
                const hasDerived = metadata.hasDerived(args.table, col);
                metadata.remove(args.table, col, 'working');
                if (hasDerived) {
                    const derivedRecord = metadata.getDerived(args.table, col);
                    try {
                        const rows = mgr.getAllRows(args.table);
                        const result = evaluateExpression(derivedRecord.expr, rows, {
                            partitionBy: derivedRecord.partitionBy,
                        });
                        mgr.overwriteColumn(args.table, col, result.values);
                        restored.push(col);
                    }
                    catch {
                        metadata.remove(args.table, col, 'derived');
                        mgr.dropColumn(args.table, col);
                        manifestUpdated = true;
                    }
                }
                else {
                    mgr.dropColumn(args.table, col);
                }
                dropped.push(col);
            }
        }
        if (manifestUpdated) {
            const entry = deps.sourceManager.get(args.sourceId);
            if (entry?.config) {
                const schema = await ctx.source.getSchema();
                const manifestPath = resolveManifestPath(entry.config);
                const tableNames = schema.tables.map((t) => t.name);
                writeManifest(metadata, tableNames, manifestPath);
            }
        }
        ctx.source.invalidateSchema?.();
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
function resolveWildcard(columns, layer, metadata, table) {
    if (columns.length !== 1 || columns[0] !== '*')
        return columns;
    if (!layer) {
        return 'When using ["*"], you must specify a layer (derived or working)';
    }
    const resolved = metadata.list(table, layer).map(r => r.column);
    if (resolved.length === 0)
        return `No ${layer} columns to drop`;
    return resolved;
}
//# sourceMappingURL=drop-columns.js.map