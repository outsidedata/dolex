/**
 * MCP Tool: query_data
 * Execute a SQL query against a source and return tabular results.
 */
import { z } from 'zod';
export declare const querySourceInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
    sql: z.ZodString;
    maxRows: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sql: string;
    sourceId: string;
    maxRows?: number | undefined;
}, {
    sql: string;
    sourceId: string;
    maxRows?: number | undefined;
}>;
export declare function handleQuerySource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof querySourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
