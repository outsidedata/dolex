import { errorResponse, jsonResponse, connectAndValidateTable, isTransformError } from './shared.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { executeSingleTransform, executeBatchTransform } from '../../transforms/pipeline.js';
export function handleTransformData(deps) {
    return async (args) => {
        const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
        if (isTransformError(ctx))
            return ctx;
        const metadata = new TransformMetadata(ctx.db);
        metadata.init();
        const transformedNames = new Set(metadata.list(args.table).map(r => r.column));
        const sourceColumns = ctx.table.columns.map((c) => c.name).filter((n) => !transformedNames.has(n));
        try {
            const result = args.transforms
                ? executeBatchTransform(ctx.db, metadata, {
                    sourceId: args.sourceId,
                    table: args.table,
                    transforms: args.transforms,
                    type: args.type,
                    filter: args.filter,
                    partitionBy: args.partitionBy,
                }, sourceColumns)
                : executeSingleTransform(ctx.db, metadata, {
                    sourceId: args.sourceId,
                    table: args.table,
                    create: args.create,
                    expr: args.expr,
                    type: args.type,
                    filter: args.filter,
                    partitionBy: args.partitionBy,
                }, sourceColumns);
            ctx.source.invalidateSchema?.();
            return jsonResponse({
                created: result.created.map(c => ({
                    column: c.column,
                    expr: c.expr,
                    type: c.type,
                    layer: c.layer,
                    overwritten: c.overwritten,
                    stats: c.stats,
                })),
                warnings: result.warnings,
                working_column_count: result.working_column_count,
                derived_column_count: result.derived_column_count,
                total_columns: result.total_columns,
            });
        }
        catch (err) {
            return errorResponse(err.message);
        }
    };
}
//# sourceMappingURL=transform-data.js.map