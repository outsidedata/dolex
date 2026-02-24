/**
 * MCP Tool: export_html
 * Returns the full rendered HTML for a previously-created visualization.
 * Accepts a specId from a visualize or refine call.
 *
 * Designed for programmatic consumption — the returned HTML is a complete,
 * self-contained document that can be opened in a browser or screenshotted.
 *
 * When writeTo is provided, writes to disk instead of returning in response (saves tokens).
 */
import { z } from 'zod';
export declare const exportHtmlInputSchema: z.ZodObject<{
    specId: z.ZodString;
    writeTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    specId: string;
    writeTo?: string | undefined;
}, {
    specId: string;
    writeTo?: string | undefined;
}>;
export declare function handleExportHtml(): (args: z.infer<typeof exportHtmlInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=export-html.d.ts.map