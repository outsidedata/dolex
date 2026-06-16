/**
 * Shared D3 rendering utilities — axes, scales, colors, margins, tooltips.
 */
import type { VisualizationSpec, AxisEncoding, ColorEncoding } from '../../types.js';
import { categorical, sequential, diverging, DARK_BG, AXIS_COLOR, GRID_COLOR, TEXT_COLOR, TEXT_MUTED } from '../../theme/colors.js';
export declare const DEFAULT_MARGINS: {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
export { categorical as DEFAULT_PALETTE } from '../../theme/colors.js';
export { categorical, sequential, diverging };
export { DARK_BG, AXIS_COLOR, GRID_COLOR, TEXT_COLOR, TEXT_MUTED };
/**
 * Escape HTML special characters to prevent XSS in tooltips and labels.
 * Always wrap user/data values with this before inserting into innerHTML.
 */
export declare function escapeHtml(value: unknown): string;
/**
 * Tagged template literal that auto-escapes all interpolated values.
 * HTML structure in the template strings is preserved; only dynamic values are escaped.
 *
 * Usage: tooltipHtml`<strong>${name}</strong><br/>Value: ${value}`
 */
export declare function tooltipHtml(strings: TemplateStringsArray, ...values: unknown[]): string;
/**
 * Parse a value into a Date, with special handling for year integers.
 * Returns null if the value cannot be parsed.
 */
export declare function parseDate(v: any): Date | null;
export interface ChartDimensions {
    width: number;
    height: number;
    innerWidth: number;
    innerHeight: number;
    margin: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
}
/**
 * Create an SVG element inside the container and return the root <g> group
 * translated by the margin. Also returns computed dimensions.
 */
export declare function createSvg(container: HTMLElement, spec: VisualizationSpec, marginOverrides?: Partial<typeof DEFAULT_MARGINS>, options?: {
    background?: boolean;
}): {
    svg: any;
    g: any;
    dims: ChartDimensions;
};
export declare function buildXScale(encoding: AxisEncoding | undefined, data: Record<string, any>[], innerWidth: number): any;
export declare function buildYScale(encoding: AxisEncoding | undefined, data: Record<string, any>[], innerHeight: number): any;
export declare function buildColorScale(encoding: ColorEncoding | undefined, data: Record<string, any>[], valueField?: string): any;
/**
 * Return a readable text color (white or near-black) for a given background.
 * Uses WCAG relative luminance to pick the higher-contrast option.
 * Works with hex (#rgb, #rrggbb), rgb(), and rgba() strings.
 */
export declare function contrastText(bgColor: string): string;
/**
 * Return a muted/secondary text color appropriate for the given background.
 * Similar to contrastText but at reduced emphasis.
 */
export declare function contrastTextMuted(bgColor: string): string;
/**
 * Calculate adaptive tick count based on available pixel space.
 * Prevents crowded ticks on small charts and sparse ticks on large ones.
 */
export declare function getAdaptiveTickCount(availableSpace: number, minSpacing?: number): number;
/**
 * Calculate required left margin for horizontal bar charts
 * based on the longest category label.
 */
export declare function calculateLeftMargin(labels: string[], fontSize?: number): number;
/**
 * Check if axis labels need rotation based on available width per bar.
 * Returns true when average label width exceeds 80% of bar width.
 */
export declare function shouldRotateLabels(labels: string[], barWidth: number, fontSize?: number): boolean;
/**
 * Calculate required bottom margin for vertical bar charts.
 * When labels are rotated, they need more vertical space.
 */
export declare function calculateBottomMargin(labels: string[], willRotate: boolean, fontSize?: number): number;
/**
 * Truncate label if it exceeds max length, preserving full text for tooltips.
 * Uses Unicode ellipsis character.
 */
export declare function truncateLabel(label: string, maxLength?: number): string;
/**
 * Truncate an SVG <text> element in-place if it exceeds maxWidth pixels.
 * Uses getComputedTextLength() for accurate measurement.
 * Adds an SVG <title> tooltip with the full text when truncated.
 */
export declare function truncateTitle(textEl: any, fullText: string, maxWidth: number): void;
/**
 * Render an "All values are zero" empty state centered in the chart area.
 * Returns true if empty state was rendered (caller should return early).
 */
export declare function renderEmptyState(g: any, dims: ChartDimensions, message?: string): void;
/**
 * Check if all numeric values for a given field are zero.
 */
export declare function isAllZeros(data: Record<string, any>[], field: string): boolean;
/**
 * Determine if value labels should be shown based on bar dimensions.
 * Explicit `config.showLabels` takes precedence; otherwise auto-enable
 * when bars are large enough to fit text.
 *
 * For horizontal bars: check bandwidth (height) >= 20px
 * For vertical bars: check bandwidth (width) >= 35px
 */
export declare function shouldShowValueLabels(config: VisualizationSpec['config'], barDimension: number, isHorizontal: boolean): boolean;
export declare function drawXAxis(g: any, xScale: any, innerHeight: number, label?: string, isOrdinal?: boolean): void;
export declare function drawYAxis(g: any, yScale: any, innerWidth: number, label?: string): void;
/**
 * Apply consistent axis styling: grid lines, domain stroke, tick text.
 * Also applies smart formatting to fix tiny-decimal "0.00" labels and
 * deduplicates tick labels when the domain is narrow.
 * All renderers should use this instead of styling axes manually.
 */
export declare function styleAxis(axis: any): void;
export declare function createTooltip(container: HTMLElement): HTMLDivElement;
export declare function positionTooltip(tooltip: HTMLDivElement, event: MouseEvent): void;
export declare function showTooltip(tooltip: HTMLDivElement, html: string, event: MouseEvent): void;
export declare function hideTooltip(tooltip: HTMLDivElement): void;
export interface LegendCallbacks {
    onHover?: (label: string) => void;
    onLeave?: () => void;
}
export interface LegendEntry {
    label: string;
    color: string;
    extra?: string;
}
export interface LegendOptions {
    shape?: 'square' | 'circle' | 'line' | 'line-dot';
    callbacks?: LegendCallbacks;
    maxItems?: number;
}
/**
 * Create a standardised HTML flex-wrap legend.
 *
 * Accepts either a d3 color scale (domain → colors) or an explicit array of
 * `LegendEntry` objects for one-off legends (e.g. waterfall, connected-dot-plot).
 */
export declare function smartTruncateLabels(labels: string[], maxLen: number): string[];
export declare function createLegend(source: any, options?: LegendOptions): HTMLDivElement;
/**
 * Highlight a single legend item by fading others.
 * Pass empty string or null to reset all to full opacity.
 */
export declare function highlightLegendItem(legendDiv: HTMLDivElement, activeKey: string | null): void;
export declare function renderPlaceholder(container: HTMLElement, spec: VisualizationSpec): void;
/**
 * Add minimal interactive sort controls to any categorical chart.
 * Positioned in the top-right corner, on the same line as the title.
 * Controls are hidden by default and appear on chart hover.
 *
 * @param svg - The D3 SVG selection
 * @param container - The DOM container (cleared + re-rendered on sort)
 * @param spec - The visualization spec (mutated with new sortBy/sortOrder)
 * @param dims - Chart dimensions
 * @param renderFn - The render function to call after sorting (e.g. renderBar, renderStackedBar)
 */
export declare function addSortControls(svg: any, container: HTMLElement, spec: VisualizationSpec, dims: ChartDimensions, renderFn: (container: HTMLElement, spec: VisualizationSpec) => void): void;
export declare function formatValue(v: number): string;
/**
 * Set up a flex-column container with dark background for charts that
 * render SVG inside a wrapper div (with optional legend below).
 * Returns the chart wrapper div.
 */
export declare function setupFlexContainer(container: HTMLElement): HTMLDivElement;
/**
 * Apply -35° rotation to x-axis tick labels.
 * Call after the axis has been rendered.
 */
export declare function applyLabelRotation(axis: any): void;
/**
 * Shared curve interpolation map for time-series renderers.
 * Must be called inside the renderer (needs d3 reference).
 */
export declare function getCurveMap(): Record<string, any>;
