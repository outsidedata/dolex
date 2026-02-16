/**
 * Dolex Design System — Typography Tokens
 *
 * Consistent type scale for chart titles, labels, annotations, and UI elements.
 * Designed for data-dense visualizations where readability at small sizes is critical.
 *
 * Font stack: Inter is the primary face (excellent tabular figures, narrow at small sizes).
 * Falls back through system-ui to ensure consistent metrics cross-platform.
 */

// ─── FONT FAMILIES ────────────────────────────────────────────────────────────

export const fontFamily = {
  /** Primary sans-serif stack for all chart text */
  sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  /** Monospace stack for data values, code, and tabular figures */
  mono: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Consolas, monospace',
} as const;

// ─── FONT SIZES ───────────────────────────────────────────────────────────────
//
// Pixel values. SVG text uses these directly; CSS renderers can convert to rem.
// Scale is tighter than typical UI because chart text lives inside constrained space.

export const fontSize = {
  /** Chart title — the largest text element in a visualization */
  title: 14,
  /** Chart subtitle, section headers within legends */
  subtitle: 12,
  /** Axis labels, legend items, tick labels */
  label: 11,
  /** Annotations, footnotes, data source attribution */
  annotation: 10,
  /** Sparkline labels, dense small-multiples, compact mode ticks */
  micro: 9,
} as const;

export type FontSizeKey = keyof typeof fontSize;

// ─── FONT WEIGHTS ─────────────────────────────────────────────────────────────

export const fontWeight = {
  /** Body text, tick labels, legend items */
  regular: 400,
  /** Axis titles, emphasized labels */
  medium: 500,
  /** Chart titles, highlighted values */
  semibold: 600,
} as const;

export type FontWeightKey = keyof typeof fontWeight;

// ─── LINE HEIGHTS ─────────────────────────────────────────────────────────────
//
// Unitless multipliers relative to font-size. Tighter for chart elements
// (single-line), looser for multi-line annotations.

export const lineHeight = {
  /** Single-line chart elements: titles, labels, ticks */
  tight: 1.2,
  /** Default for most text */
  normal: 1.4,
  /** Multi-line annotations, tooltip content, descriptions */
  relaxed: 1.6,
} as const;

export type LineHeightKey = keyof typeof lineHeight;

// ─── LETTER SPACING ───────────────────────────────────────────────────────────
//
// Em values. Slight tracking aids legibility at small sizes.

export const letterSpacing = {
  /** Default — no adjustment */
  normal: '0em',
  /** Slight expansion for labels at micro size */
  wide: '0.02em',
  /** Uppercase text or very small elements */
  wider: '0.04em',
} as const;

// ─── COMPOSITE TEXT STYLES ────────────────────────────────────────────────────
//
// Pre-composed styles for common chart text roles. Each combines size, weight,
// and line-height into a single token that renderers can spread onto elements.

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
}

export const textStyles = {
  /** Chart title */
  chartTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  /** Chart subtitle or legend header */
  chartSubtitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  /** Axis titles */
  axisTitle: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  /** Tick labels, legend item text */
  axisLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  /** Data labels placed on or near marks */
  dataLabel: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  /** Annotations and footnotes */
  annotation: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.annotation,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.wide,
  },
  /** Very small text for dense layouts */
  micro: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.micro,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.tight,
    letterSpacing: letterSpacing.wider,
  },
  /** Monospace data values (tables, tooltips) */
  dataValue: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.label,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  /** Tooltip text */
  tooltip: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.relaxed,
    letterSpacing: letterSpacing.normal,
  },
} as const satisfies Record<string, TextStyle>;

export type TextStyleKey = keyof typeof textStyles;
