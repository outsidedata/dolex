/**
 * MCP Tool: query_data
 * Runs the constrained LLM pipeline to query a data source.
 * This is the local/private mode tool — for users who can't send data to cloud APIs.
 */
import { z } from 'zod';
export declare const queryDataInputSchema: z.ZodObject<{
    query: z.ZodString;
    sourceId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    query: string;
    sourceId: string;
    sessionId?: string | undefined;
    model?: string | undefined;
}, {
    query: string;
    sourceId: string;
    sessionId?: string | undefined;
    model?: string | undefined;
}>;
/**
 * Creates the query_data tool handler.
 * Requires the query engine and source manager to be injected.
 */
export declare function handleQueryData(deps: {
    queryEngine: any;
    sourceManager: any;
}): (args: z.infer<typeof queryDataInputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
} | {
    content: {
        type: "text";
        text: string;
    }[];
    isError?: undefined;
}>;
//# sourceMappingURL=query-data.d.ts.map