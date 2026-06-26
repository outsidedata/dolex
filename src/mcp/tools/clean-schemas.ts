import { z } from 'zod';

export const cleanColumnSchema = z.object({
  sourceId: z.string().describe('Dataset ID returned by load_csv'),
  table: z.string().describe('Table name within the source'),
  column: z.string().describe('The column to clean'),
  code: z.string().describe('A Python 3 function `def clean(value):` taking ONE raw cell value — ALWAYS a string, or None (cast it yourself with int()/float() before any numeric work) — and returning the cleaned value (None for missing/sentinel). May import stdlib (datetime, re). No I/O.'),
  newColumn: z.string().optional().describe('Name for the cleaned column (default: <column>_clean). Non-destructive — the original column is kept.'),
  apply: z.boolean().optional().describe('false (default) = PREVIEW (validate + show before→after, no write). true = write the cleaned column.'),
});
