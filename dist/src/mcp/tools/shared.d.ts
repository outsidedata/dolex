/**
 * Shared utilities for MCP tool handlers.
 *
 * Consolidates duplicated logic:
 * - MCP response builders (error/success/html patterns)
 * - Column inference from data rows
 * - Color preference application to visualization specs
 */
import type { DataColumn, VisualizationSpec, CompoundVisualizationSpec } from '../../types.js';
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
export declare function buildOutputHtml(spec: VisualizationSpec | CompoundVisualizationSpec): string | undefined;
export declare function writeHtmlToDisk(html: string, writeTo: string): {
    ok: true;
    message: string;
} | {
    ok: false;
    error: string;
};
export declare function formatUptime(ms: number): string;
export interface ResolvedData {
    data: Record<string, any>[];
    queryMeta?: {
        truncated?: boolean;
        totalSourceRows?: number;
    };
    extraMeta?: {
        sqlPreview?: string;
        sourceType?: string;
    };
}
/**
 * Resolves data from one of three sources: sourceId+sql, resultId, or inline data.
 * Returns the resolved data or an error response.
 */
export declare function resolveData(args: {
    data?: Record<string, any>[];
    resultId?: string;
    sourceId?: string;
    sql?: string;
}, deps: {
    sourceManager?: any;
    getResult: (id: string) => {
        rows: Record<string, any>[];
        columns: {
            name: string;
            type: string;
        }[];
    } | null;
}): Promise<ResolvedData | McpResponse>;
/** Type guard: checks if a resolveData result is an error response. */
export declare function isErrorResponse(result: ResolvedData | McpResponse): result is McpResponse;
export interface TransformContext {
    source: any;
    db: any;
    table: any;
}
/**
 * Shared setup for all transform tools: connect to source, get database handle,
 * validate table exists. Returns either the context or an error response.
 */
export declare function connectAndValidateTable(deps: {
    sourceManager: any;
}, sourceId: string, tableName: string): Promise<TransformContext | McpResponse>;
/** Type guard: checks if a connectAndValidateTable result is an error response. */
export declare function isTransformError(result: TransformContext | McpResponse): result is McpResponse;
export {};
//# sourceMappingURL=shared.d.ts.map