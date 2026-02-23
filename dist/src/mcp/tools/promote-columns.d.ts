/**
 * MCP Tool: promote_columns
 *
 * Promotes working columns to derived (persisted in .dolex.json manifest).
 */
import type { z } from 'zod';
import type { promoteColumnsSchema } from './transform-schemas.js';
export declare function handlePromoteColumns(deps: {
    sourceManager: any;
}): (args: z.infer<typeof promoteColumnsSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=promote-columns.d.ts.map