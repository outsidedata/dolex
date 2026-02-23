import { errorResponse, jsonResponse } from './shared.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { ColumnManager } from '../../transforms/column-manager.js';
export function handleListTransforms(deps) {
    return async (args) => {
        const connResult = await deps.sourceManager.connect(args.sourceId);
        if (!connResult.ok) {
            return errorResponse(`Source not found: ${args.sourceId}`);
        }
        const source = connResult.source;
        const db = source.getDatabase?.();
        if (!db) {
            return errorResponse('Source does not support transforms (no database handle)');
        }
        const schema = await source.getSchema();
        const table = schema.tables.find((t) => t.name === args.table);
        if (!table) {
            const available = schema.tables.map((t) => t.name);
            return errorResponse(`Table '${args.table}' not found. Available: [${available.join(', ')}]`);
        }
        const metadata = new TransformMetadata(db);
        metadata.init();
        const mgr = new ColumnManager(db);
        const allColumns = mgr.getColumnNames(args.table);
        // Classify columns
        const derivedRecords = metadata.list(args.table, 'derived');
        const workingRecords = metadata.list(args.table, 'working');
        const derivedNames = new Set(derivedRecords.map(r => r.column));
        const workingNames = new Set(workingRecords.map(r => r.column));
        const sourceColumns = allColumns.filter(c => !derivedNames.has(c) && !workingNames.has(c));
        return jsonResponse({
            source_columns: sourceColumns,
            derived_columns: derivedRecords.map(r => ({
                column: r.column,
                expr: r.expr,
                type: r.type,
                ...(r.partitionBy ? { partitionBy: r.partitionBy } : {}),
            })),
            working_columns: workingRecords.map(r => ({
                column: r.column,
                expr: r.expr,
                type: r.type,
                ...(r.partitionBy ? { partitionBy: r.partitionBy } : {}),
            })),
            total_columns: allColumns.length,
        });
    };
}
//# sourceMappingURL=list-transforms.js.map