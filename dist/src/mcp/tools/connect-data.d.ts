import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
export declare const connectDataInputSchema: z.ZodObject<{
    path: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path?: string | undefined;
}, {
    path?: string | undefined;
}>;
export declare function handleConnectData(deps: {
    sourceManager: any;
    server: McpServer;
}): (args: z.infer<typeof connectDataInputSchema>, _extra: any) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=connect-data.d.ts.map