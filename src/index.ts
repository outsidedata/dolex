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

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type {
  DataColumn,
  DataTable,
  ForeignKey,
  DataSchema,
  DataSourceType,
  DataSourceInfo,
  DataSourceConfig,
  PatternCategory,
  DataRequirements,
  SelectionRule,
  PatternMatchContext,
  VisualizationPattern,
  VisualizationSpec,
  AxisEncoding,
  ColorEncoding,
  SizeEncoding,
  VisualizationRecommendation,
  VisualizeInput,
  VisualizeOutput,
  RefineInput,
  RefineOutput,
  CompoundVisualizationSpec,
  CompoundView,
  TableViewSpec,
  TableColumn,
  CompoundLayout,
  Interaction,
  DslJoin,
  DslQuery,
  DslSelectField,
  DslAggregateField,
  DslWindowFunction,
  DslWindowField,
  DslGroupByField,
  DslFilter,
  DslFilterOp,
  DslOrderBy,
  DslAggregate,
  SourceDataRef,
  DashboardSpec,
  DashboardViewSpec,
  DashboardFilter,
  DashboardLayout,
  DashboardInteraction,
} from './types.js';

export { isCompoundSpec, isDashboardSpec, isDslAggregateField, isDslWindowField } from './types.js';

// ─── PATTERNS ────────────────────────────────────────────────────────────────

export { registry } from './patterns/registry.js';
export { selectPattern } from './patterns/selector.js';

// ─── THEME ───────────────────────────────────────────────────────────────────

export {
  theme,
  darkThemeComposed,
  lightThemeComposed,
  getTheme,
  categorical,
  sequential,
  diverging,
  semantic,
  darkTheme,
  lightTheme,
  fontFamily,
  fontSize,
  fontWeight,
  textStyles,
  space,
  margins,
  padding,
  gap,
  radius,
  stroke,
  chartSize,
  animation,
} from './theme/index.js';

export type { Theme } from './theme/index.js';

// ─── UTILITIES ───────────────────────────────────────────────────────────────

export {
  measureText,
  truncateLabel,
  abbreviate,
  avoidCollisions,
  labelStrategy,
  getContainerMode,
  responsiveMargins,
  responsiveFontSize,
  responsiveTicks,
  svgToString,
  inlineStyles,
  downloadSvg,
  svgToPng,
} from './utils/index.js';

// ─── HTML BUILDERS ───────────────────────────────────────────────────────────

export {
  buildChartHtml,
  getSupportedHtmlPatterns,
  isHtmlPatternSupported,
  buildHtml,
} from './renderers/html/index.js';

export { buildCompoundHtml } from './renderers/html/builders/compound.js';
export { buildDashboardHtml } from './renderers/html/builders/dashboard.js';
export type { DashboardViewData } from './renderers/html/builders/dashboard.js';
export { shouldCompound, buildCompoundSpec } from './renderers/html/compound.js';
