/**
 * Output rendering: write HTML to disk, open it in the default browser, and
 * render a chart HTML string to a PNG via headless Chromium (Playwright, loaded
 * lazily so it stays an optional dependency).
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { spawn } from 'child_process';
import { dolexHome } from './paths.js';
import { importOptional } from '../utils/optional-deps.js';
/** Default location for charts when no `--out` is given. */
export function defaultChartPath(specId) {
    return join(dolexHome(), 'charts', `chart-${specId}.html`);
}
/** Write HTML to a path (creating parent dirs). Returns the absolute path. */
export function writeHtmlFile(html, outPath) {
    const abs = resolve(outPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, html, 'utf-8');
    return abs;
}
/** Open a file in the OS default application (browser for HTML). Best-effort. */
export function openInBrowser(filePath) {
    const abs = resolve(filePath);
    let cmd;
    let args;
    switch (process.platform) {
        case 'darwin':
            cmd = 'open';
            args = [abs];
            break;
        case 'win32':
            cmd = 'cmd';
            args = ['/c', 'start', '', abs];
            break;
        default:
            cmd = 'xdg-open';
            args = [abs];
    }
    try {
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        child.unref();
    }
    catch {
        /* opening is best-effort */
    }
}
/**
 * Render a chart HTML string to a PNG file via headless Chromium.
 * Throws a friendly error if Playwright is not installed.
 */
export async function renderPng(html, outPath, opts = {}) {
    // Playwright is an optional dependency — importOptional turns a missing
    // package into a friendly "install this" error instead of ERR_MODULE_NOT_FOUND.
    const { chromium } = await importOptional('playwright', 'png');
    const abs = resolve(outPath);
    mkdirSync(dirname(abs), { recursive: true });
    let browser;
    try {
        browser = await chromium.launch();
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/Executable doesn't exist|playwright install|download new browsers/i.test(msg)) {
            throw new Error('PNG export needs the Chromium browser. Install it with:\n  npx playwright install chromium');
        }
        throw new Error(`Could not launch Chromium for PNG export: ${msg}`);
    }
    try {
        const page = await browser.newPage({
            viewport: { width: opts.width ?? 900, height: opts.height ?? 650 },
            deviceScaleFactor: 2,
        });
        try {
            await page.setContent(html, { waitUntil: 'networkidle' });
            await page.waitForTimeout(350);
            await page.screenshot({ path: abs, type: 'png' });
            return abs;
        }
        finally {
            await page.close();
        }
    }
    finally {
        await browser.close();
    }
}
