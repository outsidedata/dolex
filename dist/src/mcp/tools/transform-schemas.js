/**
 * Zod input schemas for the 4 derived data layer MCP tools.
 */
import { z } from 'zod';
import { rowFilterSchema } from './sql-schemas.js';
export const transformDataBaseSchema = z.object({
    sourceId: z.string().describe('Dataset ID returned by load_csv'),
    table: z.string().describe('Table name within the source'),
    create: z.string().optional().describe('Column name to create (single-column mode)'),
    expr: z.string().optional().describe('Expression to evaluate (single-column mode). Examples: "score * 2", "zscore(score)", "if_else(age > 18, \"adult\", \"minor\")".'),
    transforms: z.array(z.object({
        create: z.string().describe('Column name to create'),
        expr: z.string().describe('Expression to evaluate'),
    })).optional().describe('Batch mode: array of { create, expr } pairs. Executed sequentially — later expressions can reference earlier ones. All-or-nothing on failure.'),
    type: z.enum(['numeric', 'categorical', 'date', 'boolean']).optional().describe('Force output type. Auto-inferred if omitted.'),
    filter: z.array(rowFilterSchema).optional().describe('Only evaluate for matching rows. Non-matching rows get null.'),
    partitionBy: z.string().optional().describe('Compute column-wise stats (zscore, rank, etc.) within groups of this column.'),
});
export const transformDataSchema = transformDataBaseSchema.refine((d) => (d.create && d.expr) || d.transforms, { message: 'Provide either (create + expr) for single-column mode, or transforms array for batch mode' }).refine((d) => !((d.create || d.expr) && d.transforms), { message: 'Cannot use both single-column and batch mode' });
export const promoteColumnsSchema = z.object({
    sourceId: z.string().describe('Dataset ID returned by load_csv'),
    table: z.string().describe('Table name within the source'),
    columns: z.array(z.string()).describe('Column names to promote from working → derived. Use ["*"] to promote all working columns.'),
});
export const listTransformsSchema = z.object({
    sourceId: z.string().describe('Dataset ID returned by load_csv'),
    table: z.string().describe('Table name within the source'),
});
export const dropColumnsSchema = z.object({
    sourceId: z.string().describe('Dataset ID returned by load_csv'),
    table: z.string().describe('Table name within the source'),
    columns: z.array(z.string()).describe('Column names to drop. Use ["*"] to drop all columns in the specified layer.'),
    layer: z.enum(['derived', 'working']).optional().describe('Which layer to drop from. If omitted, auto-detects.'),
});
//# sourceMappingURL=transform-schemas.js.map