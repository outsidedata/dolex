/**
 * Dolex Visualization Pattern Library — Public API.
 *
 * This module is the main entry point for all pattern-related functionality.
 * It re-exports the registry, selector, utilities, and all pattern definitions.
 *
 * Usage:
 *   import { selectPattern, registry } from './patterns/index.js';
 *
 *   const result = selectPattern(data, columns, "compare revenue by region");
 *   console.log(result.recommended.spec);
 */

// ─── CORE API ────────────────────────────────────────────────────────────────

export { registry } from './registry.js';
export { selectPattern, quickRecommend, scoreSpecificPattern } from './selector.js';
export type { SelectionResult } from './selector.js';

// ─── UTILITIES ───────────────────────────────────────────────────────────────

export {
  buildMatchContext,
  parseIntent,
  hasTimeSeriesColumn,
  countCategories,
  countSeries,
  hasNegativeValues,
  getValueRange,
  detectHierarchy,
  findColumnByType,
  findColumnsByType,
  inferFieldType,
  inferEncoding,
} from './utils.js';

// ─── PATTERN DEFINITIONS ─────────────────────────────────────────────────────
// Re-exported for direct access when needed.

// Comparison
export {
  barPattern,
  divergingBarPattern,
  slopeChartPattern,
  connectedDotPlotPattern,
  bumpChartPattern,
} from './definitions/comparison/index.js';

// Distribution
export {
  histogramPattern,
  beeswarmPattern,
  violinPattern,
  ridgelinePattern,
  stripPlotPattern,
} from './definitions/distribution/index.js';

// Composition
export {
  stackedBarPattern,
  wafflePattern,
  treemapPattern,
  sunburstPattern,
} from './definitions/composition/index.js';

// Time
export {
  linePattern,
  smallMultiplesPattern,
  sparklineGridPattern,
  calendarHeatmapPattern,
} from './definitions/time/index.js';

// Relationship
export {
  scatterPattern,
  connectedScatterPattern,
  parallelCoordinatesPattern,
  radarPattern,
} from './definitions/relationship/index.js';

// Flow
export {
  sankeyPattern,
  alluvialPattern,
  chordPattern,
} from './definitions/flow/index.js';
