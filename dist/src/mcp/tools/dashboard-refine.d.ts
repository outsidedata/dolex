/**
 * MCP Tool: refine_dashboard
 *
 * Takes a current dashboard spec and a natural language refinement,
 * applies changes, re-executes affected queries, and returns the updated dashboard.
 *
 * Refinement categories:
 * - Add view: "add a chart showing X"
 * - Remove view: "remove the trend chart" / "remove view-2"
 * - Modify view: "change the bar chart to show top 5"
 * - Layout: "make it 3 columns" / "make view-1 wider"
 * - Filters: "add a region filter"
 * - Theme: "dark mode" / "light mode"
 * - Swap: "swap view-1 and view-2"
 * - Pattern override: "show the trend as an area chart"
 */
import { z } from 'zod';
import { refineDashboardInputSchema } from './dsl-schemas.js';
export { refineDashboardInputSchema };
export declare function handleRefineDashboard(deps: {
    sourceManager: any;
}): (args: z.infer<typeof refineDashboardInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=dashboard-refine.d.ts.map