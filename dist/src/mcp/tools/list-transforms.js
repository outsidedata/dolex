import { jsonResponse, connectAndValidateTable, isTransformError } from './shared.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { ColumnManager } from '../../transforms/column-manager.js';
export function handleListTransforms(deps) {
    return async (args) => {
        const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
        if (isTransformError(ctx))
            return ctx;
        const metadata = new TransformMetadata(ctx.db);
        metadata.init();
        const mgr = new ColumnManager(ctx.db);
        const allColumns = mgr.getColumnNames(args.table);
        const derivedRecords = metadata.list(args.table, 'derived');
        const workingRecords = metadata.list(args.table, 'working');
        const derivedNames = new Set(derivedRecords.map(r => r.column));
        const workingNames = new Set(workingRecords.map(r => r.column));
        const sourceColumns = allColumns.filter(c => !derivedNames.has(c) && !workingNames.has(c));
        function formatRecord(r) {
            return {
                column: r.column,
                expr: r.expr,
                type: r.type,
                ...(r.partitionBy ? { partitionBy: r.partitionBy } : {}),
            };
        }
        return jsonResponse({
            source_columns: sourceColumns,
            derived_columns: derivedRecords.map(formatRecord),
            working_columns: workingRecords.map(formatRecord),
            total_columns: allColumns.length,
        });
    };
}
//# sourceMappingURL=list-transforms.js.map