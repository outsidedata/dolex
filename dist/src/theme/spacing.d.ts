/**
 * Dolex Design System — Spacing Tokens
 *
 * Consistent spacing scales for chart margins, padding, and layout gaps.
 * Three size modes accommodate different container sizes and information density.
 *
 * All values are in pixels. SVG renderers use them directly;
 * CSS-based renderers can convert as needed.
 */
export declare const space: {
    readonly 0: 0;
    readonly 1: 1;
    readonly 2: 2;
    readonly 4: 4;
    readonly 6: 6;
    readonly 8: 8;
    readonly 12: 12;
    readonly 16: 16;
    readonly 20: 20;
    readonly 24: 24;
    readonly 32: 32;
    readonly 40: 40;
    readonly 48: 48;
    readonly 64: 64;
};
export type SpaceKey = keyof typeof space;
export interface ChartMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export declare const margins: {
    /** For sparklines, small-multiples, and tight dashboard tiles */
    readonly compact: {
        readonly top: 24;
        readonly right: 16;
        readonly bottom: 32;
        readonly left: 40;
    };
    /** Standard chart margins — room for title, axis labels, ticks */
    readonly default: {
        readonly top: 40;
        readonly right: 30;
        readonly bottom: 50;
        readonly left: 60;
    };
    /** Large charts with subtitles, annotations, and detailed axis labels */
    readonly spacious: {
        readonly top: 56;
        readonly right: 40;
        readonly bottom: 64;
        readonly left: 76;
    };
};
export type MarginMode = keyof typeof margins;
export declare const padding: {
    /** Tooltip padding */
    readonly tooltip: {
        readonly x: 12;
        readonly y: 8;
    };
    /** Legend container padding */
    readonly legend: {
        readonly x: 12;
        readonly y: 8;
    };
    /** Card / panel padding */
    readonly card: {
        readonly x: 16;
        readonly y: 12;
    };
    /** Inline badge / chip padding */
    readonly badge: {
        readonly x: 8;
        readonly y: 4;
    };
};
export declare const gap: {
    /** Between legend color swatch and label text */
    readonly legendSwatch: 6;
    /** Between legend items (vertical stack) */
    readonly legendItem: 4;
    /** Between legend items (horizontal row) */
    readonly legendItemHorizontal: 16;
    /** Between small-multiple panels */
    readonly smallMultiple: 12;
    /** Between label and its data mark */
    readonly labelOffset: 4;
    /** Between title and subtitle */
    readonly titleSubtitle: 4;
    /** Between chart title area and plot area */
    readonly titleToPlot: 8;
    /** Between adjacent bars in grouped bar charts */
    readonly barGroup: 2;
    /** Between tick label and axis line */
    readonly tickPadding: 8;
    /** Between annotation callout and target point */
    readonly annotationOffset: 8;
};
export declare const radius: {
    /** No rounding */
    readonly none: 0;
    /** Subtle rounding for bars, marks */
    readonly sm: 2;
    /** Default for cards, containers */
    readonly md: 6;
    /** Larger rounding for panels, modals */
    readonly lg: 8;
    /** Rounded pill shape for badges */
    readonly full: 9999;
};
export declare const stroke: {
    /** Hairline — grid lines, subtle separators */
    readonly hairline: 0.5;
    /** Thin — axis lines, borders */
    readonly thin: 1;
    /** Default — lines in line charts, mark outlines */
    readonly default: 1.5;
    /** Medium — emphasized lines, hover outlines */
    readonly medium: 2;
    /** Thick — primary trend line, active selections */
    readonly thick: 3;
};
export declare const chartSize: {
    /** Dashboard tile, sparkline */
    readonly thumbnail: {
        readonly width: 300;
        readonly height: 200;
    };
    /** Small panel in a grid */
    readonly small: {
        readonly width: 480;
        readonly height: 320;
    };
    /** Standard standalone chart */
    readonly medium: {
        readonly width: 640;
        readonly height: 420;
    };
    /** Full-width chart */
    readonly large: {
        readonly width: 800;
        readonly height: 500;
    };
    /** Presentation / export */
    readonly xlarge: {
        readonly width: 1080;
        readonly height: 640;
    };
};
export type ChartSizeKey = keyof typeof chartSize;
export declare const animation: {
    /** Fast micro-interactions: hover, focus */
    readonly fast: {
        readonly duration: 150;
        readonly easing: "ease-out";
    };
    /** Default transitions: enter, exit */
    readonly default: {
        readonly duration: 300;
        readonly easing: "ease-in-out";
    };
    /** Slow/dramatic: layout shifts, data updates */
    readonly slow: {
        readonly duration: 600;
        readonly easing: "ease-in-out";
    };
};
//# sourceMappingURL=spacing.d.ts.map