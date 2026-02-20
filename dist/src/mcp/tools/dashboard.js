/**
 * MCP Tool: create_dashboard
 *
 * Creates a multi-view dashboard from a data source.
 * Each view has its own DSL query and intent for pattern selection.
 * Supports global filters and cross-view interactions.
 */
import { buildDashboardHtml } from '../../renderers/html/builders/dashboard.js';
import { createDashboardInputSchema } from './dsl-schemas.js';
import { errorResponse, htmlResponse, autoLayout, executeDashboardViews, isViewExecutionError, } from './shared.js';
export { createDashboardInputSchema };
export function handleCreateDashboard(deps) {
    return async (args) => {
        const sourceInfo = deps.sourceManager.get(args.sourceId);
        if (!sourceInfo) {
            return errorResponse(`Dataset not found: ${args.sourceId}. Use load_csv first.`);
        }
        const result = await executeDashboardViews(args.views, args.sourceId, args.table, deps.sourceManager);
        if (isViewExecutionError(result))
            return result;
        const layout = args.layout || autoLayout(args.views.length);
        const dashboardId = `dashboard-${Date.now().toString(36)}`;
        const dashboardSpec = {
            dashboard: true,
            id: dashboardId,
            title: args.title || 'Dashboard',
            description: args.description,
            sourceId: args.sourceId,
            table: args.table,
            views: args.views,
            globalFilters: args.globalFilters,
            layout,
            interactions: args.interactions,
            theme: args.theme,
        };
        const html = buildDashboardHtml(dashboardSpec, result.viewData);
        return htmlResponse({ dashboardSpec, viewReasonings: result.viewReasonings }, html);
    };
}
//# sourceMappingURL=dashboard.js.map