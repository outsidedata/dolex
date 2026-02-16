/**
 * Dolex — Visualization Intelligence for AI
 *
 * Main barrel export. Provides access to:
 * - Pattern library (definitions, registry, selector)
 * - Theme tokens (colors, typography, spacing)
 * - Utilities (smart labels, responsive, export)
 * - HTML builders (self-contained chart documents)
 * - Types
 *
 * React components are exported from 'dolex/react' separately
 * to avoid requiring React as a dependency for non-React users.
 */
export { isCompoundSpec, isDashboardSpec, isDslAggregateField, isDslWindowField } from './types.js';
// ─── PATTERNS ────────────────────────────────────────────────────────────────
export { registry } from './patterns/registry.js';
export { selectPattern } from './patterns/selector.js';
// ─── THEME ───────────────────────────────────────────────────────────────────
export { theme, darkThemeComposed, lightThemeComposed, getTheme, categorical, sequential, diverging, semantic, darkTheme, lightTheme, fontFamily, fontSize, fontWeight, textStyles, space, margins, padding, gap, radius, stroke, chartSize, animation, } from './theme/index.js';
// ─── UTILITIES ───────────────────────────────────────────────────────────────
export { measureText, truncateLabel, abbreviate, avoidCollisions, labelStrategy, getContainerMode, responsiveMargins, responsiveFontSize, responsiveTicks, svgToString, inlineStyles, downloadSvg, svgToPng, } from './utils/index.js';
// ─── HTML BUILDERS ───────────────────────────────────────────────────────────
export { buildChartHtml, getSupportedHtmlPatterns, isHtmlPatternSupported, buildHtml, } from './renderers/html/index.js';
export { buildCompoundHtml } from './renderers/html/builders/compound.js';
export { buildDashboardHtml } from './renderers/html/builders/dashboard.js';
export { shouldCompound, buildCompoundSpec } from './renderers/html/compound.js';
//# sourceMappingURL=index.js.map