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
// ─── RE-EXPORTS ───────────────────────────────────────────────────────────────
export { categorical, sequential, diverging, semantic, colorSchemes, darkTheme, lightTheme, 
// Backward-compatibility aliases
DEFAULT_PALETTE, DARK_BG, AXIS_COLOR, GRID_COLOR, TEXT_COLOR, TEXT_MUTED, } from './colors.js';
export { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles, } from './typography.js';
export { space, margins, padding, gap, radius, stroke, chartSize, animation, } from './spacing.js';
// ─── COMPOSED THEME ───────────────────────────────────────────────────────────
import { categorical, sequential, diverging, semantic, colorSchemes, darkTheme as darkColors, lightTheme as lightColors, } from './colors.js';
import { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles, } from './typography.js';
import { space, margins, padding, gap, radius, stroke, chartSize, animation, } from './spacing.js';
/** Shared tokens that do not change between light and dark themes */
const sharedTokens = {
    palettes: {
        categorical,
        sequential,
        diverging,
    },
    colorSchemes,
    semantic,
    typography: {
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight,
        letterSpacing,
        textStyles,
    },
    spacing: {
        space,
        margins,
        padding,
        gap,
        radius,
        stroke,
        chartSize,
        animation,
    },
};
/** Dark theme (default) — all tokens composed into one object */
export const darkThemeComposed = {
    mode: 'dark',
    colors: darkColors,
    ...sharedTokens,
};
/** Light theme — same structure, swapped color tokens */
export const lightThemeComposed = {
    mode: 'light',
    colors: lightColors,
    ...sharedTokens,
};
/**
 * Default theme. Dark mode.
 *
 * Import as:
 *   import { theme } from '../theme/index.js';
 *   const bg = theme.colors.background;
 *   const blue = theme.palettes.categorical[0];
 *   const titleFont = theme.typography.textStyles.chartTitle;
 */
export const theme = darkThemeComposed;
/**
 * Resolve a theme by name.
 *
 * @param mode - 'dark' or 'light'
 * @returns The corresponding composed theme object
 */
export function getTheme(mode) {
    return mode === 'light' ? lightThemeComposed : darkThemeComposed;
}
//# sourceMappingURL=index.js.map