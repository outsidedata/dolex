import { jsonResponse, connectAndValidateTable, isTransformError } from './shared.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { ColumnManager } from '../../transforms/column-manager.js';
export function handleListTransforms(deps) {
    return async (args) => {
        const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
        if (isTransformError(ctx))
            return ctx;
        // Live sources (Postgres/Mongo) have no SQLite handle. Their derived columns are
        // session-local (created via transform_data) and surface in the introspected schema
        // tagged layer:'derived'. List those from the schema instead of dereferencing a null
        // db handle (which previously threw "Cannot read properties of undefined").
        if (!ctx.db) {
            const schema = await ctx.source.getSchema();
            const tbl = schema.tables.find((t) => t.name === args.table);
            const cols = tbl?.columns ?? [];
            const derived = cols.filter((c) => c.layer === 'derived');
            const sourceCols = cols.filter((c) => c.layer !== 'derived');
            return jsonResponse({
                source_columns: sourceCols.map((c) => c.name),
                derived_columns: derived.map((c) => ({
                    column: c.name,
                    layer: 'derived',
                    note: 'session-local (created via transform_data); expression not tracked on a live source',
                })),
                working_columns: [],
                total_columns: cols.length,
                note: `Live ${ctx.source.type} source — derived columns are session-local to this connection and are not persisted (no working layer or manifest). Recreate them with transform_data.`,
            });
        }
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
