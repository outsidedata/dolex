/**
 * Dolex Design System — Theme Entry Point
 *
 * Re-exports every token module and composes them into a unified `theme` object.
 * Dark theme is the default; light theme is available for print / light-mode contexts.
 *
 * Usage:
 *   import { theme } from '../theme/index.js';
 *   // or cherry-pick:
 *   import { categorical, darkTheme } from '../theme/colors.js';
 *   import { textStyles } from '../theme/typography.js';
 *   import { margins } from '../theme/spacing.js';
 */
export { categorical, sequential, diverging, semantic, colorSchemes, darkTheme, lightTheme, DEFAULT_PALETTE, DARK_BG, AXIS_COLOR, GRID_COLOR, TEXT_COLOR, TEXT_MUTED, } from './colors.js';
export type { CategoricalPalette, SequentialPaletteName, DivergingPaletteName, ThemeColors, SemanticColors, ColorSchemeName, } from './colors.js';
export { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles, } from './typography.js';
export type { FontSizeKey, FontWeightKey, LineHeightKey, TextStyle, TextStyleKey, } from './typography.js';
export { space, margins, padding, gap, radius, stroke, chartSize, animation, } from './spacing.js';
export type { SpaceKey, ChartMargins, MarginMode, ChartSizeKey, } from './spacing.js';
import { semantic, colorSchemes } from './colors.js';
/** Shared tokens that do not change between light and dark themes */
declare const sharedTokens: {
    readonly palettes: {
        readonly categorical: readonly ["#6280c1", "#c99a3e", "#48a882", "#c46258", "#5ea4c8", "#9e74bf", "#c88450", "#3ea898", "#b85e78", "#85a63e", "#807cba", "#b09838"];
        readonly sequential: {
            readonly blue: readonly ["#e8f0fe", "#c5d9fc", "#9cbcf8", "#6e9cf4", "#4a7eec", "#2f63d9", "#1d4cb8", "#143893", "#0d2668"];
            readonly green: readonly ["#e2f5ec", "#b6e6d0", "#7ed4ae", "#4cc08c", "#2ba86f", "#1e8d58", "#157244", "#0d5833", "#084024"];
            readonly purple: readonly ["#f0e8ff", "#d8c6fd", "#bd9efa", "#a278f3", "#8755e8", "#6d3dd1", "#5630ab", "#402485", "#2d1961"];
            readonly warm: readonly ["#fef0e2", "#fdd9b4", "#fbbd7e", "#f79e4d", "#ef7e25", "#d4620f", "#ac4a0a", "#843608", "#5e2506"];
        };
        readonly diverging: {
            readonly blueRed: readonly ["#2166ac", "#4393c3", "#6db4d5", "#a6d1e8", "#e0e0e0", "#f1b0a0", "#e07060", "#ca3832", "#b2182b"];
            readonly greenPurple: readonly ["#1b7837", "#41a055", "#73c378", "#a8dda0", "#e0e0e0", "#c4a5d9", "#9970be", "#7640a0", "#5e2d84"];
            readonly tealOrange: readonly ["#0d6b6e", "#2a9191", "#54b4b0", "#92d4cc", "#e0e0e0", "#f5c28a", "#e69b44", "#c87422", "#a35212"];
            readonly redGreen: readonly ["#b84040", "#c85e5e", "#d48080", "#daa8a8", "#c8c8c8", "#a0c8a0", "#68a868", "#489048", "#307430"];
        };
    };
    readonly colorSchemes: {
        readonly 'traffic-light': readonly ["#ef4444", "#f59e0b", "#10b981"];
        readonly 'profit-loss': readonly ["#ef4444", "#6b7280", "#10b981"];
        readonly temperature: readonly ["#3b82f6", "#9ca3af", "#f59e0b"];
    };
    readonly semantic: {
        readonly positive: "#3dd9a0";
        readonly negative: "#ff6b5e";
        readonly neutral: "#9ca3af";
        readonly warning: "#ffb938";
        readonly info: "#56c8f5";
    };
    readonly typography: {
        readonly fontFamily: {
            readonly sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
            readonly mono: "\"JetBrains Mono\", \"Fira Code\", \"SF Mono\", Menlo, Consolas, monospace";
        };
        readonly fontSize: {
            readonly title: 14;
            readonly subtitle: 12;
            readonly label: 11;
            readonly annotation: 10;
            readonly micro: 9;
        };
        readonly fontWeight: {
            readonly regular: 400;
            readonly medium: 500;
            readonly semibold: 600;
        };
        readonly lineHeight: {
            readonly tight: 1.2;
            readonly normal: 1.4;
            readonly relaxed: 1.6;
        };
        readonly letterSpacing: {
            readonly normal: "0em";
            readonly wide: "0.02em";
            readonly wider: "0.04em";
        };
        readonly textStyles: {
            readonly chartTitle: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 14;
                readonly fontWeight: 600;
                readonly lineHeight: 1.2;
                readonly letterSpacing: "0em";
            };
            readonly chartSubtitle: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 12;
                readonly fontWeight: 500;
                readonly lineHeight: 1.2;
                readonly letterSpacing: "0em";
            };
            readonly axisTitle: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 12;
                readonly fontWeight: 500;
                readonly lineHeight: 1.2;
                readonly letterSpacing: "0em";
            };
            readonly axisLabel: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 11;
                readonly fontWeight: 400;
                readonly lineHeight: 1.2;
                readonly letterSpacing: "0em";
            };
            readonly dataLabel: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 11;
                readonly fontWeight: 500;
                readonly lineHeight: 1.2;
                readonly letterSpacing: "0em";
            };
            readonly annotation: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 10;
                readonly fontWeight: 400;
                readonly lineHeight: 1.6;
                readonly letterSpacing: "0.02em";
            };
            readonly micro: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 9;
                readonly fontWeight: 400;
                readonly lineHeight: 1.2;
                readonly letterSpacing: "0.04em";
            };
            readonly dataValue: {
                readonly fontFamily: "\"JetBrains Mono\", \"Fira Code\", \"SF Mono\", Menlo, Consolas, monospace";
                readonly fontSize: 11;
                readonly fontWeight: 400;
                readonly lineHeight: 1.4;
                readonly letterSpacing: "0em";
            };
            readonly tooltip: {
                readonly fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
                readonly fontSize: 12;
                readonly fontWeight: 400;
                readonly lineHeight: 1.6;
                readonly letterSpacing: "0em";
            };
        };
    };
    readonly spacing: {
        readonly space: {
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
        readonly margins: {
            readonly compact: {
                readonly top: 24;
                readonly right: 16;
                readonly bottom: 32;
                readonly left: 40;
            };
            readonly default: {
                readonly top: 40;
                readonly right: 30;
                readonly bottom: 50;
                readonly left: 60;
            };
            readonly spacious: {
                readonly top: 56;
                readonly right: 40;
                readonly bottom: 64;
                readonly left: 76;
            };
        };
        readonly padding: {
            readonly tooltip: {
                readonly x: 12;
                readonly y: 8;
            };
            readonly legend: {
                readonly x: 12;
                readonly y: 8;
            };
            readonly card: {
                readonly x: 16;
                readonly y: 12;
            };
            readonly badge: {
                readonly x: 8;
                readonly y: 4;
            };
        };
        readonly gap: {
            readonly legendSwatch: 6;
            readonly legendItem: 4;
            readonly legendItemHorizontal: 16;
            readonly smallMultiple: 12;
            readonly labelOffset: 4;
            readonly titleSubtitle: 4;
            readonly titleToPlot: 8;
            readonly barGroup: 2;
            readonly tickPadding: 8;
            readonly annotationOffset: 8;
        };
        readonly radius: {
            readonly none: 0;
            readonly sm: 2;
            readonly md: 6;
            readonly lg: 8;
            readonly full: 9999;
        };
        readonly stroke: {
            readonly hairline: 0.5;
            readonly thin: 1;
            readonly default: 1.5;
            readonly medium: 2;
            readonly thick: 3;
        };
        readonly chartSize: {
            readonly thumbnail: {
                readonly width: 300;
                readonly height: 200;
            };
            readonly small: {
                readonly width: 480;
                readonly height: 320;
            };
            readonly medium: {
                readonly width: 640;
                readonly height: 420;
            };
            readonly large: {
                readonly width: 800;
                readonly height: 500;
            };
            readonly xlarge: {
                readonly width: 1080;
                readonly height: 640;
            };
        };
        readonly animation: {
            readonly fast: {
                readonly duration: 150;
                readonly easing: "ease-out";
            };
            readonly default: {
                readonly duration: 300;
                readonly easing: "ease-in-out";
            };
            readonly slow: {
                readonly duration: 600;
                readonly easing: "ease-in-out";
            };
        };
    };
};
import type { ThemeColors } from './colors.js';
export interface Theme {
    mode: 'dark' | 'light';
    colors: ThemeColors;
    palettes: typeof sharedTokens.palettes;
    colorSchemes: typeof colorSchemes;
    semantic: typeof semantic;
    typography: typeof sharedTokens.typography;
    spacing: typeof sharedTokens.spacing;
}
/** Dark theme (default) — all tokens composed into one object */
export declare const darkThemeComposed: Theme;
/** Light theme — same structure, swapped color tokens */
export declare const lightThemeComposed: Theme;
/**
 * Default theme. Dark mode.
 *
 * Import as:
 *   import { theme } from '../theme/index.js';
 *   const bg = theme.colors.background;
 *   const blue = theme.palettes.categorical[0];
 *   const titleFont = theme.typography.textStyles.chartTitle;
 */
export declare const theme: Theme;
/**
 * Resolve a theme by name.
 *
 * @param mode - 'dark' or 'light'
 * @returns The corresponding composed theme object
 */
export declare function getTheme(mode: 'dark' | 'light'): Theme;
//# sourceMappingURL=index.d.ts.map