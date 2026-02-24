/**
 * Shared utilities for MCP tool handlers.
 *
 * Consolidates duplicated logic:
 * - MCP response builders (error/success/html patterns)
 * - Column inference from data rows
 * - Color preference application to visualization specs
 */
import type { DataColumn, VisualizationSpec } from '../../types.js';
type McpTextContent = {
    type: 'text';
    text: string;
};
export interface McpResponse {
    [key: string]: unknown;
    content: McpTextContent[];
    isError?: boolean;
    structuredContent?: {
        specId?: string;
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
export declare function formatUptime(ms: number): string;
export {};
//# sourceMappingURL=shared.d.ts.map