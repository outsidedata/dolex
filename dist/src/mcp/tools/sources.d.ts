/**
 * MCP Tools: list_data, load_csv, remove_data, describe_data
 * Manage CSV datasets.
 */
import { z } from 'zod';
export declare function isSandboxPath(filePath: string): boolean;
export declare const addSourceInputSchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    detail: z.ZodDefault<z.ZodEnum<["compact", "full"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    path: string;
    detail: "compact" | "full";
}, {
    name: string;
    path: string;
    detail?: "compact" | "full" | undefined;
}>;
export declare const removeSourceInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceId: string;
}, {
    sourceId: string;
}>;
export declare const describeSourceInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodOptional<z.ZodString>;
    detail: z.ZodDefault<z.ZodEnum<["compact", "full"]>>;
}, "strip", z.ZodTypeAny, {
    sourceId: string;
    detail: "compact" | "full";
    table?: string | undefined;
}, {
    sourceId: string;
    table?: string | undefined;
    detail?: "compact" | "full" | undefined;
}>;
export declare function handleListSources(deps: {
    sourceManager: any;
}): () => Promise<import("./shared.js").McpResponse>;
export declare function handleAddSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof addSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
export declare function handleRemoveSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof removeSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
export declare function handleDescribeSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof describeSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=sources.d.ts.map