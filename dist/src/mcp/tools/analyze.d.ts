/**
 * MCP Tool: analyze_data
 * Examines a data source and generates a structured analysis plan with DSL queries.
 */
import { z } from 'zod';
export declare const analyzeSourceInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodOptional<z.ZodString>;
    maxSteps: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sourceId: string;
    table?: string | undefined;
    maxSteps?: number | undefined;
}, {
    sourceId: string;
    table?: string | undefined;
    maxSteps?: number | undefined;
}>;
export declare function handleAnalyzeSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof analyzeSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=analyze.d.ts.map