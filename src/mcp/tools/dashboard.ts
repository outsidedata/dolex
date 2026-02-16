/**
 * MCP Tool: create_dashboard
 *
 * Creates a multi-view dashboard from a data source.
 * Each view has its own DSL query and intent for pattern selection.
 * Supports global filters and cross-view interactions.
 */

import { z } from 'zod';
import type { DashboardSpec, DashboardViewSpec } from '../../types.js';
import { buildDashboardHtml } from '../../renderers/html/builders/dashboard.js';
import { createDashboardInputSchema } from './dsl-schemas.js';
import {
  errorResponse,
  htmlResponse,
  autoLayout,
  executeDashboardViews,
  isViewExecutionError,
} from './shared.js';

export { createDashboardInputSchema };

export function handleCreateDashboard(deps: { sourceManager: any }) {
  return async (args: z.infer<typeof createDashboardInputSchema>) => {
    const sourceInfo = deps.sourceManager.get(args.sourceId);
    if (!sourceInfo) {
      return errorResponse(`Source not found: ${args.sourceId}. Use add_source first.`);
    }

    const result = await executeDashboardViews(
      args.views as DashboardViewSpec[],
      args.sourceId,
      args.table,
      deps.sourceManager,
    );
    if (isViewExecutionError(result)) return result;

    const layout = args.layout || autoLayout(args.views.length);
    const dashboardId = `dashboard-${Date.now().toString(36)}`;

    const dashboardSpec: DashboardSpec = {
      dashboard: true,
      id: dashboardId,
      title: args.title || 'Dashboard',
      description: args.description,
      sourceId: args.sourceId,
      table: args.table,
      views: args.views as DashboardViewSpec[],
      globalFilters: args.globalFilters as DashboardSpec['globalFilters'],
      layout,
      interactions: args.interactions as DashboardSpec['interactions'],
      theme: args.theme,
    };

    const html = buildDashboardHtml(dashboardSpec, result.viewData);

    return htmlResponse(
      { dashboardSpec, viewReasonings: result.viewReasonings },
      html,
    );
  };
}
