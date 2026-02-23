/**
 * Types for the Dolex derived data layer.
 *
 * Expression tokenizer, parser, evaluator, and transform pipeline types.
 */
import { z } from 'zod';
// ─── MANIFEST ZOD SCHEMA ────────────────────────────────────────────────────
export const manifestEntrySchema = z.object({
    column: z.string(),
    expr: z.string(),
    type: z.enum(['numeric', 'categorical', 'date', 'boolean']),
    partitionBy: z.string().optional(),
});
export const manifestSchema = z.object({
    version: z.literal(1),
    tables: z.record(z.string(), z.array(manifestEntrySchema)),
});
export const COLUMN_TYPES = ['numeric', 'categorical', 'date', 'boolean'];
//# sourceMappingURL=types.js.map