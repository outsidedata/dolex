/**
 * Output rendering: write HTML to disk, open it in the default browser, and
 * render a chart HTML string to a PNG via headless Chromium (Playwright, loaded
 * lazily so it stays an optional dependency).
 */
/** Default location for charts when no `--out` is given. */
export declare function defaultChartPath(specId: string): string;
/** Write HTML to a path (creating parent dirs). Returns the absolute path. */
export declare function writeHtmlFile(html: string, outPath: string): string;
/** Open a file in the OS default application (browser for HTML). Best-effort. */
export declare function openInBrowser(filePath: string): void;
/**
 * Render a chart HTML string to a PNG file via headless Chromium.
 * Throws a friendly error if Playwright is not installed.
 */
export declare function renderPng(html: string, outPath: string, opts?: {
    width?: number;
    height?: number;
}): Promise<string>;
