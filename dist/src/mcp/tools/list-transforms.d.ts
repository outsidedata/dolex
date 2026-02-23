/**
 * MCP Tool: list_transforms
 *
 * Lists all columns for a table with their layer status and expressions.
 */
import type { z } from 'zod';
import type { listTransformsSchema } from './transform-schemas.js';
export declare function handleListTransforms(deps: {
    sourceManager: any;
}): (args: z.infer<typeof listTransformsSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=list-transforms.d.ts.map