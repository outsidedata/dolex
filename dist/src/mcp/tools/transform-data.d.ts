/**
 * MCP Tool: transform_data
 *
 * Creates derived columns using the expression language.
 * Supports single-column and batch modes.
 */
import type { z } from 'zod';
import type { transformDataSchema } from './transform-schemas.js';
export declare function handleTransformData(deps: {
    sourceManager: any;
}): (args: z.infer<typeof transformDataSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=transform-data.d.ts.map