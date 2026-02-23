/**
 * Shared Zod schemas for the SQL query layer.
 * Used by query_data and the visualize tool.
 */
import { z } from 'zod';

// ─── ROW FILTER SCHEMA (for transform pipeline) ────────────────────────────

export const rowFilterSchema = z.object({
  field: z.string().describe('Field to filter on'),
  op: z.enum(['=', '!=', '>', '>=', '<', '<=', 'in', 'not_in', 'between', 'is_null', 'is_not_null']).describe('Comparison operator'),
  value: z.any().optional().describe('Filter value. For "in"/"not_in": use an array. For "between": use [min, max]. For "is_null"/"is_not_null": omit.'),
});

// ─── DASHBOARD SCHEMAS ──────────────────────────────────────────────────────

export const ALL_PALETTE_NAMES = [
  'categorical', 'blue', 'green', 'purple', 'warm',
  'blueRed', 'greenPurple', 'tealOrange', 'redGreen',
  'traffic-light', 'profit-loss', 'temperature',
] as const;

