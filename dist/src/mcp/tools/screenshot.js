/**
 * MCP Tool: screenshot
 * Renders a visualization to PNG via headless Chromium (Playwright).
 * Returns a base64-encoded image that Claude can see directly.
 *
 * Requires: npm install playwright && npx playwright install chromium
 */
import { z } from 'zod';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import { errorResponse } from './shared.js';
export const screenshotInputSchema = z.object({
    specId: z.string().describe('Spec ID from a previous visualize or refine call'),
    width: z.number().optional().describe('Image width in pixels (default: 800)'),
    height: z.number().optional().describe('Image height in pixels (default: 600)'),
});
let browserInstance = null;
async function getBrowser() {
    if (browserInstance && browserInstance.isConnected()) {
        return browserInstance;
    }
    const pw = await import('playwright');
    browserInstance = await pw.chromium.launch();
    return browserInstance;
}
export async function closeBrowser() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
export function handleScreenshot() {
    return async (args) => {
        const stored = specStore.get(args.specId);
        if (!stored) {
            return errorResponse(`Spec "${args.specId}" not found or expired. Create a new visualization first.`);
        }
        const { spec } = stored;
        let html;
        if (isCompoundSpec(spec)) {
            html = buildCompoundHtml(spec);
        }
        else if (isHtmlPatternSupported(spec.pattern)) {
            html = buildChartHtml(spec);
        }
        else {
            return errorResponse(`Pattern "${spec.pattern}" does not have an HTML builder.`);
        }
        const width = args.width ?? 800;
        const height = args.height ?? 600;
        let browser;
        try {
            browser = await getBrowser();
        }
        catch {
            return errorResponse('Playwright is not installed. Run: npm install playwright && npx playwright install chromium');
        }
        const page = await browser.newPage({ viewport: { width, height } });
        try {
            await page.setContent(html, { waitUntil: 'networkidle' });
            await page.waitForTimeout(300);
            const buffer = await page.screenshot({ type: 'png' });
            const base64 = buffer.toString('base64');
            return {
                content: [{
                        type: 'image',
                        data: base64,
                        mimeType: 'image/png',
                    }],
            };
        }
        finally {
            await page.close();
        }
    };
}
//# sourceMappingURL=screenshot.js.map