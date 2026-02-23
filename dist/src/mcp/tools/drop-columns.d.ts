/**
 * MCP Tool: drop_columns
 *
 * Drops derived or working columns. Handles dependency validation,
 * shadow restoration, and manifest updates.
 */
import type { z } from 'zod';
import type { dropColumnsSchema } from './transform-schemas.js';
export declare function handleDropColumns(deps: {
    sourceManager: any;
}): (args: z.infer<typeof dropColumnsSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=drop-columns.d.ts.map