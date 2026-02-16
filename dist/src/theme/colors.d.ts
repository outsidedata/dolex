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
export declare const categorical: readonly ["#6280c1", "#c99a3e", "#48a882", "#c46258", "#5ea4c8", "#9e74bf", "#c88450", "#3ea898", "#b85e78", "#85a63e", "#807cba", "#b09838"];
export type CategoricalPalette = typeof categorical;
export declare const sequential: {
    /** Blue ramp — default for most continuous data */
    readonly blue: readonly ["#e8f0fe", "#c5d9fc", "#9cbcf8", "#6e9cf4", "#4a7eec", "#2f63d9", "#1d4cb8", "#143893", "#0d2668"];
    /** Green ramp — good for "positive" continuous metrics */
    readonly green: readonly ["#e2f5ec", "#b6e6d0", "#7ed4ae", "#4cc08c", "#2ba86f", "#1e8d58", "#157244", "#0d5833", "#084024"];
    /** Purple ramp — alternative for avoiding blue/green overuse */
    readonly purple: readonly ["#f0e8ff", "#d8c6fd", "#bd9efa", "#a278f3", "#8755e8", "#6d3dd1", "#5630ab", "#402485", "#2d1961"];
    /** Warm ramp — orange-based, for density or heat-related data */
    readonly warm: readonly ["#fef0e2", "#fdd9b4", "#fbbd7e", "#f79e4d", "#ef7e25", "#d4620f", "#ac4a0a", "#843608", "#5e2506"];
};
export type SequentialPaletteName = keyof typeof sequential;
export declare const diverging: {
    /** Blue-to-Red — most common diverging scheme (cold/hot, below/above) */
    readonly blueRed: readonly ["#2166ac", "#4393c3", "#6db4d5", "#a6d1e8", "#e0e0e0", "#f1b0a0", "#e07060", "#ca3832", "#b2182b"];
    /** Green-to-Purple — colorblind-safe alternative to blue/red */
    readonly greenPurple: readonly ["#1b7837", "#41a055", "#73c378", "#a8dda0", "#e0e0e0", "#c4a5d9", "#9970be", "#7640a0", "#5e2d84"];
    /** Teal-to-Orange — high contrast diverging scheme */
    readonly tealOrange: readonly ["#0d6b6e", "#2a9191", "#54b4b0", "#92d4cc", "#e0e0e0", "#f5c28a", "#e69b44", "#c87422", "#a35212"];
    /** Red-to-Green — stock market / profit-loss diverging scheme */
    readonly redGreen: readonly ["#b84040", "#c85e5e", "#d48080", "#daa8a8", "#c8c8c8", "#a0c8a0", "#68a868", "#489048", "#307430"];
};
export type DivergingPaletteName = keyof typeof diverging;
export declare const semantic: {
    /** Positive values, gains, growth, success */
    readonly positive: "#3dd9a0";
    /** Negative values, losses, decline, error */
    readonly negative: "#ff6b5e";
    /** Neutral / zero / baseline */
    readonly neutral: "#9ca3af";
    /** Warning, caution */
    readonly warning: "#ffb938";
    /** Informational, highlighted */
    readonly info: "#56c8f5";
};
export declare const darkTheme: {
    /** Primary background */
    readonly background: "#0f1117";
    /** Elevated surface (cards, panels, tooltips) */
    readonly surface: "#161822";
    /** Higher elevation surface */
    readonly surfaceRaised: "#1e2028";
    /** Axis lines, ticks */
    readonly axis: "#4b5563";
    /** Grid lines */
    readonly grid: "#1f2937";
    /** Border color for cards and containers */
    readonly border: "#2a2d3a";
    /** Primary text */
    readonly text: "#e2e5eb";
    /** Secondary text (axis labels, legends) */
    readonly textMuted: "#9ca3af";
    /** Tertiary text (annotations, captions) */
    readonly textDim: "#6b7280";
    /** Chart area fill (slightly lighter than background for depth) */
    readonly plotArea: "#13151d";
    /** Overlay / scrim for modals */
    readonly overlay: "rgba(0, 0, 0, 0.6)";
};
export declare const lightTheme: {
    /** Primary background */
    readonly background: "#f8f9fb";
    /** Elevated surface */
    readonly surface: "#ffffff";
    /** Higher elevation surface */
    readonly surfaceRaised: "#ffffff";
    /** Axis lines, ticks */
    readonly axis: "#9ca3af";
    /** Grid lines */
    readonly grid: "#e5e7eb";
    /** Border color */
    readonly border: "#d1d5db";
    /** Primary text */
    readonly text: "#111827";
    /** Secondary text */
    readonly textMuted: "#6b7280";
    /** Tertiary text */
    readonly textDim: "#9ca3af";
    /** Chart area fill */
    readonly plotArea: "#ffffff";
    /** Overlay / scrim */
    readonly overlay: "rgba(0, 0, 0, 0.3)";
};
/** Shape of a theme color set. Both dark and light themes conform to this. */
export interface ThemeColors {
    background: string;
    surface: string;
    surfaceRaised: string;
    axis: string;
    grid: string;
    border: string;
    text: string;
    textMuted: string;
    textDim: string;
    plotArea: string;
    overlay: string;
}
export type SemanticColors = typeof semantic;
export declare const colorSchemes: {
    /** Red → Yellow → Green (3-color stoplight scheme) */
    readonly 'traffic-light': readonly ["#ef4444", "#f59e0b", "#10b981"];
    /** Red → Gray → Green (diverging from zero for profit/loss) */
    readonly 'profit-loss': readonly ["#ef4444", "#6b7280", "#10b981"];
    /** Cool Blue → Neutral Gray → Warm Orange (temperature scale) */
    readonly temperature: readonly ["#3b82f6", "#9ca3af", "#f59e0b"];
};
export type ColorSchemeName = keyof typeof colorSchemes;
export declare const DEFAULT_PALETTE: readonly ["#6280c1", "#c99a3e", "#48a882", "#c46258", "#5ea4c8", "#9e74bf", "#c88450", "#3ea898", "#b85e78", "#85a63e", "#807cba", "#b09838"];
export declare const DARK_BG: "#0f1117";
export declare const AXIS_COLOR: "#4b5563";
export declare const GRID_COLOR: "#1f2937";
export declare const TEXT_COLOR: "#e2e5eb";
export declare const TEXT_MUTED: "#9ca3af";
//# sourceMappingURL=colors.d.ts.map