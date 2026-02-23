import { errorResponse, jsonResponse } from './shared.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { executeSingleTransform, executeBatchTransform } from '../../transforms/pipeline.js';
export function handleTransformData(deps) {
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
        // Source columns = schema columns minus any transform-tracked columns.
        // After schema invalidation, derived columns appear in the schema for DSL
        // validation, but they're not source columns for collision detection.
        const transformedNames = new Set(metadata.list(args.table).map(r => r.column));
        const sourceColumns = table.columns.map((c) => c.name).filter((n) => !transformedNames.has(n));
        try {
            let result;
            if (args.transforms) {
                result = executeBatchTransform(db, metadata, {
                    sourceId: args.sourceId,
                    table: args.table,
                    transforms: args.transforms,
                    type: args.type,
                    filter: args.filter,
                    partitionBy: args.partitionBy,
                }, sourceColumns);
            }
            else {
                result = executeSingleTransform(db, metadata, {
                    sourceId: args.sourceId,
                    table: args.table,
                    create: args.create,
                    expr: args.expr,
                    type: args.type,
                    filter: args.filter,
                    partitionBy: args.partitionBy,
                }, sourceColumns);
            }
            // Invalidate cached schema so DSL queries can see the new columns
            source.invalidateSchema?.();
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