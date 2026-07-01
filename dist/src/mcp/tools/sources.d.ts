/**
 * MCP Tools: list_data, load_csv, remove_data, describe_data
 * Manage CSV datasets.
 */
import { z } from 'zod';
export declare function isSandboxPath(filePath: string): boolean;
export declare const addSourceInputSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<["csv", "postgres", "mongodb"]>>;
    path: z.ZodOptional<z.ZodString>;
    uri: z.ZodOptional<z.ZodString>;
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
    database: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    passwordEnv: z.ZodOptional<z.ZodString>;
    schema: z.ZodOptional<z.ZodString>;
    collections: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type?: "csv" | "postgres" | "mongodb" | undefined;
    path?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    database?: string | undefined;
    user?: string | undefined;
    password?: string | undefined;
    passwordEnv?: string | undefined;
    schema?: string | undefined;
    uri?: string | undefined;
    collections?: string[] | undefined;
}, {
    name: string;
    type?: "csv" | "postgres" | "mongodb" | undefined;
    path?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    database?: string | undefined;
    user?: string | undefined;
    password?: string | undefined;
    passwordEnv?: string | undefined;
    schema?: string | undefined;
    uri?: string | undefined;
    collections?: string[] | undefined;
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
export declare const testSourceInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sourceId: string;
}, {
    sourceId: string;
}>;
/** Connectivity health-check for a registered source — is the saved DB reachable with its credentials?
 *  Returns a classified kind (unreachable / auth-failed / db-not-found / driver-missing / …) so the
 *  assistant can give the user a specific fix, and repair via load_source (re-register) if needed. */
export declare function handleTestSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof testSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
export declare function handleAddSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof addSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
export declare function handleRemoveSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof removeSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
export declare function handleDescribeSource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof describeSourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
