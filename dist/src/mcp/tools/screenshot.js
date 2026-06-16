/**
 * MCP Tool: screenshot
 * Renders a visualization to PNG via headless Chromium (Playwright).
 * Returns a base64-encoded image that Claude can see directly.
 *
 * Requires: npm install playwright && npx playwright install chromium
 */
import { z } from 'zod';
import { specStore } from '../spec-store.js';
import { errorResponse, buildOutputHtml } from './shared.js';
import { importOptional, MissingOptionalDependencyError } from '../../utils/optional-deps.js';
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
    // Playwright is optional — importOptional throws a friendly, actionable
    // MissingOptionalDependencyError (relayed to the agent) if it isn't installed.
    const pw = await importOptional('playwright', 'png');
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
        const html = buildOutputHtml(stored.spec);
        if (!html) {
            return errorResponse(`Spec "${args.specId}" does not have an HTML builder.`);
        }
        const width = args.width ?? 800;
        const height = args.height ?? 600;
        let browser;
        try {
            browser = await getBrowser();
        }
        catch (e) {
            // Missing package vs. missing browser binary — both get an actionable
            // message the agent can relay to the user. Check the typed error FIRST:
            // the package-missing message also contains "playwright install", so a
            // message regex alone would mis-route it to the browser-only branch.
            if (e instanceof MissingOptionalDependencyError) {
                return errorResponse(e.message);
            }
            const msg = e instanceof Error ? e.message : String(e);
            if (/Executable doesn't exist|download new browsers|Looks like .* install/i.test(msg)) {
                return errorResponse('PNG export needs the Chromium browser. Run: npx playwright install chromium');
            }
            return errorResponse(msg);
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
            try {
                await page?.close();
            }
            catch {
                // Ignore close errors — page may already be closed
            }
        }
    };
}
