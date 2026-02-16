/**
 * MCP Tool: create_dashboard
 *
 * Creates a multi-view dashboard from a data source.
 * Each view has its own DSL query and intent for pattern selection.
 * Supports global filters and cross-view interactions.
 */
import { z } from 'zod';
import { createDashboardInputSchema } from './dsl-schemas.js';
export { createDashboardInputSchema };
export declare function handleCreateDashboard(deps: {
    sourceManager: any;
}): (args: z.infer<typeof createDashboardInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=dashboard.d.ts.map