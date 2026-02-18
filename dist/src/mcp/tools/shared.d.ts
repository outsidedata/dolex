/**
 * Shared utilities for MCP tool handlers.
 *
 * Consolidates duplicated logic:
 * - MCP response builders (error/success/html patterns)
 * - Column inference from data rows
 * - Color preference application to visualization specs
 * - Dashboard-specific helpers (time bucket handling, auto layout)
 * - Dashboard view execution (query + pattern selection + overrides)
 */
import type { DataColumn, DslGroupByField, VisualizationSpec, DashboardViewSpec } from '../../types.js';
import type { DashboardViewData } from '../../renderers/html/builders/dashboard.js';
type McpTextContent = {
    type: 'text';
    text: string;
};
export interface McpResponse {
    [key: string]: unknown;
    content: McpTextContent[];
    isError?: boolean;
    structuredContent?: {
        html: string;
    };
}
export declare function errorResponse(message: string): McpResponse;
export declare function jsonResponse(body: unknown): McpResponse;
export declare function htmlResponse(body: unknown, html: string): McpResponse;
export declare function inferColumns(data: Record<string, any>[]): DataColumn[];
export declare function applyColorPreferences(spec: VisualizationSpec, prefs?: {
    palette?: string;
    highlight?: {
        values: any[];
        color?: string | string[];
        mutedColor?: string;
        mutedOpacity?: number;
    };
    colorField?: string;
}, data?: Record<string, any>[]): {
    notes: string[];
};
export declare function enhanceIntentForTimeBucket(intent: string, groupBy?: DslGroupByField[]): string;
export declare function applyTimeBucketColumnTypes(columns: DataColumn[], groupBy?: DslGroupByField[]): void;
export declare function formatUptime(ms: number): string;
export declare function autoLayout(viewCount: number): {
    columns: number;
};
export interface ViewExecutionResult {
    viewData: DashboardViewData[];
    viewReasonings: {
        viewId: string;
        pattern: string;
        reasoning: string;
    }[];
}
/**
 * Execute queries and select patterns for each dashboard view.
 * Shared between create_dashboard and refine_dashboard.
 */
export declare function executeDashboardViews(views: DashboardViewSpec[], sourceId: string, table: string, sourceManager: any): Promise<ViewExecutionResult | McpResponse>;
export declare function isViewExecutionError(result: ViewExecutionResult | McpResponse): result is McpResponse;
export {};
//# sourceMappingURL=shared.d.ts.map