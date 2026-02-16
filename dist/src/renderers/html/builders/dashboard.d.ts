/**
 * Self-contained HTML builder for dashboard visualizations.
 *
 * Produces a single HTML document with:
 * - Header bar with title + global filter controls
 * - CSS grid body with N chart panels
 * - Each chart rendered via buildChartHtml() embedded as srcdoc iframe
 * - Global filters operate client-side on pre-fetched data
 * - Cross-filter interaction bus between views
 */
import type { DashboardSpec, VisualizationSpec } from '../../../types.js';
/** Data payload for a resolved dashboard view — query results + resolved pattern */
export interface DashboardViewData {
    viewId: string;
    data: Record<string, any>[];
    spec: VisualizationSpec;
}
/**
 * Build a self-contained HTML document for a dashboard.
 *
 * @param dashboardSpec - The dashboard specification
 * @param viewData - Pre-resolved data + specs for each view
 * @returns Complete HTML document string
 */
export declare function buildDashboardHtml(dashboardSpec: DashboardSpec, viewData: DashboardViewData[]): string;
//# sourceMappingURL=dashboard.d.ts.map