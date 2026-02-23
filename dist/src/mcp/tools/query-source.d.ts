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
    sourceId: string;
    sql: string;
    maxRows?: number | undefined;
}, {
    sourceId: string;
    sql: string;
    maxRows?: number | undefined;
}>;
export declare function handleQuerySource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof querySourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=query-source.d.ts.map