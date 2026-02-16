/**
 * Self-contained HTML template builder for Dolex visualization specs.
 *
 * Produces a complete HTML document string that can be rendered inside
 * a sandboxed iframe in MCP Apps (Claude Desktop, ChatGPT, VS Code).
 *
 * Each document embeds:
 *   - D3 v7 via CDN
 *   - All shared rendering utilities (scales, axes, tooltips, colors)
 *   - The visualization spec as inline JSON
 *   - Pattern-specific rendering code
 */
import type { VisualizationSpec } from '../../types.js';
export declare function buildHtml(spec: VisualizationSpec, renderFunctionBody: string): string;
/**
 * Build a complete, self-contained HTML document from a pre-bundled renderer.
 *
 * Unlike `buildHtml()`, this does NOT inject `SHARED_UTILITIES_JS` because the
 * bundled code already contains all shared utilities (inlined by esbuild).
 * The bundle exposes `renderChart` as a global function.
 *
 * @param spec - The VisualizationSpec describing the chart
 * @param bundleCode - Self-contained IIFE string from _generated/bundles.ts
 * @param options - Extra scripts (e.g. topojson CDN for geo patterns)
 * @returns A complete HTML document string
 */
export declare function buildHtmlFromBundle(spec: VisualizationSpec, bundleCode: string, options?: {
    extraScripts?: string[];
}): string;
//# sourceMappingURL=template.d.ts.map