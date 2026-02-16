/**
 * MCP App HTML shell for Dolex chart viewer.
 *
 * A minimal HTML page served as a `ui://dolex/chart.html` resource.
 * It connects to the MCP Apps host via a lightweight JSON-RPC 2.0 bridge
 * and renders charts by receiving pre-built HTML in `structuredContent.html`.
 *
 * The shell is loaded once by the host, cached, and reused for each tool call.
 * Chart data arrives dynamically via the MCP Apps notification protocol.
 */
/** Chart viewer resource URI used by both the tool and the resource. */
export declare const CHART_RESOURCE_URI = "ui://dolex/chart.html";
/** Returns the complete HTML string for the MCP App shell. */
export declare function getAppShellHtml(): string;
//# sourceMappingURL=app-shell.d.ts.map