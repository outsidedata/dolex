/**
 * SVG Export Utilities — extract, inline, and download charts.
 *
 * Provides functions to serialize SVG elements to strings, inline
 * computed styles for portability, and trigger browser downloads
 * as SVG or PNG. All functions are DOM-dependent (browser only).
 */
/**
 * Serialize an SVG element to a string.
 *
 * @param svgElement - The SVG DOM element
 * @returns SVG markup string
 */
export declare function svgToString(svgElement: SVGSVGElement): string;
/**
 * Inline computed styles on all SVG child elements.
 *
 * This makes the SVG portable — it will look the same when opened
 * outside the original page context (e.g., in Illustrator, Figma).
 *
 * @param svgElement - The SVG DOM element to process (mutated in place)
 */
export declare function inlineStyles(svgElement: SVGSVGElement): void;
/**
 * Trigger a browser download of an SVG element as an .svg file.
 *
 * @param svgElement - The SVG DOM element
 * @param filename - Download filename (default 'chart.svg')
 * @param options - Optional: whether to inline styles first
 */
export declare function downloadSvg(svgElement: SVGSVGElement, filename?: string, options?: {
    inlineStyles?: boolean;
}): void;
/**
 * Convert an SVG element to a PNG data URL via canvas.
 *
 * @param svgElement - The SVG DOM element
 * @param scale - Resolution multiplier (default 2 for retina)
 * @returns Promise resolving to a PNG data URL string
 */
export declare function svgToPng(svgElement: SVGSVGElement, scale?: number): Promise<string>;
//# sourceMappingURL=export.d.ts.map