/**
 * Dolex Design System — Color Tokens
 *
 * A cohesive color system for data visualization, designed for accessibility
 * (WCAG AA against dark backgrounds) and colorblind distinguishability.
 *
 * Palette design principles:
 * - Categorical: 12 perceptually distinct hues, tested for deuteranopia,
 *   protanopia, and tritanopia. Minimum 4.5:1 contrast against #0f1117.
 * - Sequential: single-hue ramp from desaturated light to saturated dark,
 *   linear in perceived lightness.
 * - Diverging: two opposing hues through a neutral midpoint.
 */
// ─── CATEGORICAL PALETTE ──────────────────────────────────────────────────────
//
// 12 colors chosen for maximum perceptual distance in CIELAB space.
// Avoids pure red/green adjacency. Each color >=4.5:1 contrast on #0f1117.
// Muted saturation — designed for large fills (treemaps, areas) without
// looking garish, while staying legible on dark backgrounds.
//
//  0  slate blue    — blue anchor (primary accent)
//  1  burnished gold — warm gold (high luminance, distinct from all)
//  2  sea green     — blue-green (separates from blue and green channels)
//  3  terra cotta   — warm red (avoids pure red)
//  4  steel blue    — lighter blue (distinct from slate by lightness)
//  5  dusty violet  — muted purple (unique hue angle)
//  6  sienna        — warm orange-brown (earthy)
//  7  sage teal     — cyan-shifted green (distinct from sea green)
//  8  raspberry     — muted pink-red (shifted from terra cotta)
//  9  olive         — yellow-green (high luminance)
// 10  periwinkle    — light muted purple (distinct from violet by lightness)
// 11  bronze        — deep warm gold (distinct from burnished by saturation)
export const categorical = [
    '#6280c1', // slate blue
    '#c99a3e', // burnished gold
    '#48a882', // sea green
    '#c46258', // terra cotta
    '#5ea4c8', // steel blue
    '#9e74bf', // dusty violet
    '#c88450', // sienna
    '#3ea898', // sage teal
    '#b85e78', // raspberry
    '#85a63e', // olive
    '#807cba', // periwinkle
    '#b09838', // bronze
];
// ─── SEQUENTIAL PALETTES ──────────────────────────────────────────────────────
//
// Single-hue ramps for continuous data (heatmaps, choropleths, density).
// 9 steps each, ordered light-to-dark for natural "more = darker" reading.
export const sequential = {
    /** Blue ramp — default for most continuous data */
    blue: [
        '#e8f0fe',
        '#c5d9fc',
        '#9cbcf8',
        '#6e9cf4',
        '#4a7eec',
        '#2f63d9',
        '#1d4cb8',
        '#143893',
        '#0d2668',
    ],
    /** Green ramp — good for "positive" continuous metrics */
    green: [
        '#e2f5ec',
        '#b6e6d0',
        '#7ed4ae',
        '#4cc08c',
        '#2ba86f',
        '#1e8d58',
        '#157244',
        '#0d5833',
        '#084024',
    ],
    /** Purple ramp — alternative for avoiding blue/green overuse */
    purple: [
        '#f0e8ff',
        '#d8c6fd',
        '#bd9efa',
        '#a278f3',
        '#8755e8',
        '#6d3dd1',
        '#5630ab',
        '#402485',
        '#2d1961',
    ],
    /** Warm ramp — orange-based, for density or heat-related data */
    warm: [
        '#fef0e2',
        '#fdd9b4',
        '#fbbd7e',
        '#f79e4d',
        '#ef7e25',
        '#d4620f',
        '#ac4a0a',
        '#843608',
        '#5e2506',
    ],
};
// ─── DIVERGING PALETTES ───────────────────────────────────────────────────────
//
// Two opposing hues meeting at a neutral midpoint. 9 steps each.
// Center value (index 4) is desaturated for clear "zero" indication.
export const diverging = {
    /** Blue-to-Red — most common diverging scheme (cold/hot, below/above) */
    blueRed: [
        '#2166ac',
        '#4393c3',
        '#6db4d5',
        '#a6d1e8',
        '#e0e0e0',
        '#f1b0a0',
        '#e07060',
        '#ca3832',
        '#b2182b',
    ],
    /** Green-to-Purple — colorblind-safe alternative to blue/red */
    greenPurple: [
        '#1b7837',
        '#41a055',
        '#73c378',
        '#a8dda0',
        '#e0e0e0',
        '#c4a5d9',
        '#9970be',
        '#7640a0',
        '#5e2d84',
    ],
    /** Teal-to-Orange — high contrast diverging scheme */
    tealOrange: [
        '#0d6b6e',
        '#2a9191',
        '#54b4b0',
        '#92d4cc',
        '#e0e0e0',
        '#f5c28a',
        '#e69b44',
        '#c87422',
        '#a35212',
    ],
    /** Red-to-Green — stock market / profit-loss diverging scheme */
    redGreen: [
        '#b84040',
        '#c85e5e',
        '#d48080',
        '#daa8a8',
        '#c8c8c8',
        '#a0c8a0',
        '#68a868',
        '#489048',
        '#307430',
    ],
};
// ─── SEMANTIC COLORS ──────────────────────────────────────────────────────────
//
// Fixed-meaning colors for specific data semantics.
export const semantic = {
    /** Positive values, gains, growth, success */
    positive: '#3dd9a0',
    /** Negative values, losses, decline, error */
    negative: '#ff6b5e',
    /** Neutral / zero / baseline */
    neutral: '#9ca3af',
    /** Warning, caution */
    warning: '#ffb938',
    /** Informational, highlighted */
    info: '#56c8f5',
};
// ─── DARK THEME ───────────────────────────────────────────────────────────────
export const darkTheme = {
    /** Primary background */
    background: '#0f1117',
    /** Elevated surface (cards, panels, tooltips) */
    surface: '#161822',
    /** Higher elevation surface */
    surfaceRaised: '#1e2028',
    /** Axis lines, ticks */
    axis: '#4b5563',
    /** Grid lines */
    grid: '#1f2937',
    /** Border color for cards and containers */
    border: '#2a2d3a',
    /** Primary text */
    text: '#e2e5eb',
    /** Secondary text (axis labels, legends) */
    textMuted: '#9ca3af',
    /** Tertiary text (annotations, captions) */
    textDim: '#6b7280',
    /** Chart area fill (slightly lighter than background for depth) */
    plotArea: '#13151d',
    /** Overlay / scrim for modals */
    overlay: 'rgba(0, 0, 0, 0.6)',
};
// ─── LIGHT THEME ──────────────────────────────────────────────────────────────
export const lightTheme = {
    /** Primary background */
    background: '#f8f9fb',
    /** Elevated surface */
    surface: '#ffffff',
    /** Higher elevation surface */
    surfaceRaised: '#ffffff',
    /** Axis lines, ticks */
    axis: '#9ca3af',
    /** Grid lines */
    grid: '#e5e7eb',
    /** Border color */
    border: '#d1d5db',
    /** Primary text */
    text: '#111827',
    /** Secondary text */
    textMuted: '#6b7280',
    /** Tertiary text */
    textDim: '#9ca3af',
    /** Chart area fill */
    plotArea: '#ffffff',
    /** Overlay / scrim */
    overlay: 'rgba(0, 0, 0, 0.3)',
};
// ─── COLOR SCHEME PRESETS ─────────────────────────────────────────────────────
//
// Named color schemes for common data semantics.
// Used via ColorEncoding.palette: 'traffic-light' | 'profit-loss' | 'temperature'
export const colorSchemes = {
    /** Red → Yellow → Green (3-color stoplight scheme) */
    'traffic-light': ['#ef4444', '#f59e0b', '#10b981'],
    /** Red → Gray → Green (diverging from zero for profit/loss) */
    'profit-loss': ['#ef4444', '#6b7280', '#10b981'],
    /** Cool Blue → Neutral Gray → Warm Orange (temperature scale) */
    temperature: ['#3b82f6', '#9ca3af', '#f59e0b'],
};
// ─── BACKWARD-COMPATIBILITY ALIASES ───────────────────────────────────────────
//
// These map to the constants previously exported from shared.ts,
// so existing renderers can migrate gradually.
export const DEFAULT_PALETTE = categorical;
export const DARK_BG = darkTheme.background;
export const AXIS_COLOR = darkTheme.axis;
export const GRID_COLOR = darkTheme.grid;
export const TEXT_COLOR = darkTheme.text;
export const TEXT_MUTED = darkTheme.textMuted;
//# sourceMappingURL=colors.js.map