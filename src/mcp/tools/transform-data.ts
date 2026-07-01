/**
 * MCP Tool: transform_data
 *
 * Creates derived columns using the expression language.
 * Supports single-column and batch modes.
 */
import type { z } from 'zod';
import { errorResponse, jsonResponse, connectAndValidateTable, isTransformError } from './shared.js';
import type { transformDataSchema } from './transform-schemas.js';
import { TransformMetadata } from '../../transforms/metadata.js';
import { executeSingleTransform, executeBatchTransform } from '../../transforms/pipeline.js';

export function handleTransformData(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof transformDataSchema>) => {
    const ctx = await connectAndValidateTable(deps, args.sourceId, args.table);
    if (isTransformError(ctx)) return ctx;

    // Live source (PG/Mongo): materialize each derived column via the connector (native expression
    // → shadow view / $set), visible to later queries, base data untouched. No SQLite handle.
    if (!ctx.db) {
      if (typeof ctx.source.applyDerivation !== 'function') {
        return errorResponse(`This source cannot materialize a derived column (materialization: ${ctx.caps.materialization}).`);
      }
      const items = args.transforms ?? (args.create && args.expr ? [{ create: args.create, expr: args.expr }] : []);
      if (!items.length) return errorResponse('Provide `create` + `expr`, or a `transforms` array.');
      try {
        for (const t of items) await ctx.source.applyDerivation(args.table, t.create, t.expr);
        ctx.source.invalidateSchema?.();
        return jsonResponse({
          created: items.map((t) => ({ column: t.create, expr: t.expr, layer: 'derived', materialization: ctx.caps.materialization })),
          note: `Derived on the live ${ctx.source.type} source (${ctx.caps.materialization}); session-local, base data untouched.`,
        });
      } catch (err: any) {
        return errorResponse(err.message);
      }
    }

    const metadata = new TransformMetadata(ctx.db);
    metadata.init();

    const transformedNames = new Set(metadata.list(args.table).map(r => r.column));
    const sourceColumns = ctx.table.columns.map((c: any) => c.name).filter((n: string) => !transformedNames.has(n));

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
            create: args.create!,
            expr: args.expr!,
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
    } catch (err: any) {
      return errorResponse(err.message);
    }
  };
}
