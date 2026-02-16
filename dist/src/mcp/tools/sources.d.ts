/**
 * MCP Tools: list_sources, add_source, remove_source, describe_source
 * Manage data source connections.
 */
import { z } from 'zod';
export declare function isSandboxPath(filePath: string): boolean;
export declare const addSourceInputSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["csv", "sqlite", "postgres", "mysql"]>;
    config: z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"csv">;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "csv";
        path: string;
    }, {
        type: "csv";
        path: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"sqlite">;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "sqlite";
        path: string;
    }, {
        type: "sqlite";
        path: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"postgres">;
        host: z.ZodString;
        port: z.ZodDefault<z.ZodNumber>;
        database: z.ZodString;
        user: z.ZodString;
        password: z.ZodString;
        ssl: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "postgres";
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        ssl?: boolean | undefined;
    }, {
        type: "postgres";
        host: string;
        database: string;
        user: string;
        password: string;
        port?: number | undefined;
        ssl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"mysql">;
        host: z.ZodString;
        port: z.ZodDefault<z.ZodNumber>;
        database: z.ZodString;
        user: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "mysql";
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    }, {
        type: "mysql";
        host: string;
        database: string;
        user: string;
        password: string;
        port?: number | undefined;
    }>]>;
    detail: z.ZodDefault<z.ZodEnum<["compact", "full"]>>;
}, "strip", z.ZodTypeAny, {
    type: "csv" | "sqlite" | "postgres" | "mysql";
    config: {
        type: "csv";
        path: string;
    } | {
        type: "sqlite";
        path: string;
    } | {
        type: "postgres";
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
        ssl?: boolean | undefined;
    } | {
        type: "mysql";
        host: string;
        port: number;
        database: string;
        user: string;
        password: string;
    };
    name: string;
    detail: "compact" | "full";
}, {
    type: "csv" | "sqlite" | "postgres" | "mysql";
    config: {
        type: "csv";
        path: string;
    } | {
        type: "sqlite";
        path: string;
    } | {
        type: "postgres";
        host: string;
        database: string;
        user: string;
        password: string;
        port?: number | undefined;
        ssl?: boolean | undefined;
    } | {
        type: "mysql";
        host: string;
        database: string;
        user: string;
        password: string;
        port?: number | undefined;
    };
    name: string;
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