/**
 * Dolex Design System — Typography Tokens
 *
 * Consistent type scale for chart titles, labels, annotations, and UI elements.
 * Designed for data-dense visualizations where readability at small sizes is critical.
 *
 * Font stack: Inter is the primary face (excellent tabular figures, narrow at small sizes).
 * Falls back through system-ui to ensure consistent metrics cross-platform.
 */
export declare const fontFamily: {
    /** Primary sans-serif stack for all chart text */
    readonly sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
    /** Monospace stack for data values, code, and tabular figures */
    readonly mono: "\"JetBrains Mono\", \"Fira Code\", \"SF Mono\", Menlo, Consolas, monospace";
};
export declare const fontSize: {
    /** Chart title — the largest text element in a visualization */
    readonly title: 14;
    /** Chart subtitle, section headers within legends */
    readonly subtitle: 12;
    /** Axis labels, legend items, tick labels */
    readonly label: 11;
    /** Annotations, footnotes, data source attribution */
    readonly annotation: 10;
    /** Sparkline labels, dense small-multiples, compact mode ticks */
    readonly micro: 9;
};
export type FontSizeKey = keyof typeof fontSize;
export declare const fontWeight: {
    /** Body text, tick labels, legend items */
    readonly regular: 400;
    /** Axis titles, emphasized labels */
    readonly medium: 500;
    /** Chart titles, highlighted values */
    readonly semibold: 600;
};
export type FontWeightKey = keyof typeof fontWeight;
export declare const lineHeight: {
    /** Single-line chart elements: titles, labels, ticks */
    readonly tight: 1.2;
    /** Default for most text */
    readonly normal: 1.4;
    /** Multi-line annotations, tooltip content, descriptions */
    readonly relaxed: 1.6;
};
export type LineHeightKey = keyof typeof lineHeight;
export declare const letterSpacing: {
    /** Default — no adjustment */
    readonly normal: "0em";
    /** Slight expansion for labels at micro size */
    readonly wide: "0.02em";
    /** Uppercase text or very small elements */
    readonly wider: "0.04em";
};
export interface TextStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing: string;
}
export declare const textStyles: {
    /** Chart title */
    readonly chartTitle: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 14;
        readonly fontWeight: 600;
        readonly lineHeight: 1.2;
        readonly letterSpacing: "0em";
    };
    /** Chart subtitle or legend header */
    readonly chartSubtitle: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 12;
        readonly fontWeight: 500;
        readonly lineHeight: 1.2;
        readonly letterSpacing: "0em";
    };
    /** Axis titles */
    readonly axisTitle: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 12;
        readonly fontWeight: 500;
        readonly lineHeight: 1.2;
        readonly letterSpacing: "0em";
    };
    /** Tick labels, legend item text */
    readonly axisLabel: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 11;
        readonly fontWeight: 400;
        readonly lineHeight: 1.2;
        readonly letterSpacing: "0em";
    };
    /** Data labels placed on or near marks */
    readonly dataLabel: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 11;
        readonly fontWeight: 500;
        readonly lineHeight: 1.2;
        readonly letterSpacing: "0em";
    };
    /** Annotations and footnotes */
    readonly annotation: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 10;
        readonly fontWeight: 400;
        readonly lineHeight: 1.6;
        readonly letterSpacing: "0.02em";
    };
    /** Very small text for dense layouts */
    readonly micro: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 9;
        readonly fontWeight: 400;
        readonly lineHeight: 1.2;
        readonly letterSpacing: "0.04em";
    };
    /** Monospace data values (tables, tooltips) */
    readonly dataValue: {
        readonly fontFamily: "\"JetBrains Mono\", \"Fira Code\", \"SF Mono\", Menlo, Consolas, monospace";
        readonly fontSize: 11;
        readonly fontWeight: 400;
        readonly lineHeight: 1.4;
        readonly letterSpacing: "0em";
    };
    /** Tooltip text */
    readonly tooltip: {
        readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
        readonly fontSize: 12;
        readonly fontWeight: 400;
        readonly lineHeight: 1.6;
        readonly letterSpacing: "0em";
    };
};
export type TextStyleKey = keyof typeof textStyles;
//# sourceMappingURL=typography.d.ts.map