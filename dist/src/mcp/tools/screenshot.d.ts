/**
 * MCP Tool: screenshot
 * Renders a visualization to PNG via headless Chromium (Playwright).
 * Returns a base64-encoded image that Claude can see directly.
 *
 * Requires: npm install playwright && npx playwright install chromium
 */
import { z } from 'zod';
export declare const screenshotInputSchema: z.ZodObject<{
    specId: z.ZodString;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    specId: string;
    width?: number | undefined;
    height?: number | undefined;
}, {
    specId: string;
    width?: number | undefined;
    height?: number | undefined;
}>;
export declare function closeBrowser(): Promise<void>;
export declare function handleScreenshot(): (args: z.infer<typeof screenshotInputSchema>) => Promise<import("./shared.js").McpResponse | {
    content: {
        type: "image";
        data: string;
        mimeType: string;
    }[];
}>;
//# sourceMappingURL=screenshot.d.ts.map