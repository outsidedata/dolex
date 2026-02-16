/**
 * Dolex Design System — Spacing Tokens
 *
 * Consistent spacing scales for chart margins, padding, and layout gaps.
 * Three size modes accommodate different container sizes and information density.
 *
 * All values are in pixels. SVG renderers use them directly;
 * CSS-based renderers can convert as needed.
 */
// ─── BASE SPACING SCALE ──────────────────────────────────────────────────────
//
// 4px base unit. Powers of 2 progression keeps ratios harmonious.
// Named by their pixel value for clarity in a visualization context.
export const space = {
    0: 0,
    1: 1,
    2: 2,
    4: 4,
    6: 6,
    8: 8,
    12: 12,
    16: 16,
    20: 20,
    24: 24,
    32: 32,
    40: 40,
    48: 48,
    64: 64,
};
export const margins = {
    /** For sparklines, small-multiples, and tight dashboard tiles */
    compact: {
        top: 24,
        right: 16,
        bottom: 32,
        left: 40,
    },
    /** Standard chart margins — room for title, axis labels, ticks */
    default: {
        top: 40,
        right: 30,
        bottom: 50,
        left: 60,
    },
    /** Large charts with subtitles, annotations, and detailed axis labels */
    spacious: {
        top: 56,
        right: 40,
        bottom: 64,
        left: 76,
    },
};
// ─── PADDING ──────────────────────────────────────────────────────────────────
//
// Internal padding for containers, tooltips, and panels.
export const padding = {
    /** Tooltip padding */
    tooltip: { x: 12, y: 8 },
    /** Legend container padding */
    legend: { x: 12, y: 8 },
    /** Card / panel padding */
    card: { x: 16, y: 12 },
    /** Inline badge / chip padding */
    badge: { x: 8, y: 4 },
};
// ─── GAP SCALES ───────────────────────────────────────────────────────────────
//
// Spacing between repeated elements.
export const gap = {
    /** Between legend color swatch and label text */
    legendSwatch: 6,
    /** Between legend items (vertical stack) */
    legendItem: 4,
    /** Between legend items (horizontal row) */
    legendItemHorizontal: 16,
    /** Between small-multiple panels */
    smallMultiple: 12,
    /** Between label and its data mark */
    labelOffset: 4,
    /** Between title and subtitle */
    titleSubtitle: 4,
    /** Between chart title area and plot area */
    titleToPlot: 8,
    /** Between adjacent bars in grouped bar charts */
    barGroup: 2,
    /** Between tick label and axis line */
    tickPadding: 8,
    /** Between annotation callout and target point */
    annotationOffset: 8,
};
// ─── BORDER RADIUS ────────────────────────────────────────────────────────────
export const radius = {
    /** No rounding */
    none: 0,
    /** Subtle rounding for bars, marks */
    sm: 2,
    /** Default for cards, containers */
    md: 6,
    /** Larger rounding for panels, modals */
    lg: 8,
    /** Rounded pill shape for badges */
    full: 9999,
};
// ─── STROKE WIDTHS ────────────────────────────────────────────────────────────
export const stroke = {
    /** Hairline — grid lines, subtle separators */
    hairline: 0.5,
    /** Thin — axis lines, borders */
    thin: 1,
    /** Default — lines in line charts, mark outlines */
    default: 1.5,
    /** Medium — emphasized lines, hover outlines */
    medium: 2,
    /** Thick — primary trend line, active selections */
    thick: 3,
};
// ─── CHART SIZE PRESETS ───────────────────────────────────────────────────────
//
// Suggested dimensions for common chart container sizes.
export const chartSize = {
    /** Dashboard tile, sparkline */
    thumbnail: { width: 300, height: 200 },
    /** Small panel in a grid */
    small: { width: 480, height: 320 },
    /** Standard standalone chart */
    medium: { width: 640, height: 420 },
    /** Full-width chart */
    large: { width: 800, height: 500 },
    /** Presentation / export */
    xlarge: { width: 1080, height: 640 },
};
// ─── ANIMATION ────────────────────────────────────────────────────────────────
//
// Duration and easing tokens for transitions.
export const animation = {
    /** Fast micro-interactions: hover, focus */
    fast: { duration: 150, easing: 'ease-out' },
    /** Default transitions: enter, exit */
    default: { duration: 300, easing: 'ease-in-out' },
    /** Slow/dramatic: layout shifts, data updates */
    slow: { duration: 600, easing: 'ease-in-out' },
};
//# sourceMappingURL=spacing.js.map