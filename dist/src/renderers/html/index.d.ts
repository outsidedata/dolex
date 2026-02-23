/**
 * Self-contained HTML chart builder — main entry point.
 *
 * Dispatches a VisualizationSpec to the correct HTML builder based on
 * `spec.pattern`, producing a complete HTML document string that can
 * be rendered inside a sandboxed iframe in MCP Apps.
 *
 * Usage:
 *   import { buildChartHtml } from './renderers/html/index.js';
 *   const html = buildChartHtml(spec);
 *   // Write html to file or embed in iframe src via data: URL
 */
import type { VisualizationSpec } from '../../types.js';
/**
 * Build a self-contained HTML document that renders the given spec.
 *
 * Dispatches to the correct pattern-specific builder. If the pattern
 * is not yet supported, returns a placeholder HTML document showing
 * the pattern name and data summary.
 *
 * @param spec - The VisualizationSpec describing the chart
 * @returns Complete HTML document string
 */
export declare function buildChartHtml(spec: VisualizationSpec): string;
/**
 * Get the list of pattern IDs that have HTML builders.
 */
export declare function getSupportedHtmlPatterns(): string[];
/**
 * Check if a pattern has an HTML builder.
 */
export declare function isHtmlPatternSupported(pattern: string): boolean;
export { buildHtml, buildHtmlFromBundle } from './template.js';
export { buildBarHtml } from './builders/bar.js';
export { buildDivergingBarHtml } from './builders/diverging-bar.js';
export { buildSlopeChartHtml } from './builders/slope-chart.js';
export { buildHistogramHtml } from './builders/histogram.js';
export { buildBeeswarmHtml } from './builders/beeswarm.js';
export { buildStripPlotHtml } from './builders/strip-plot.js';
export { buildStackedBarHtml } from './builders/stacked-bar.js';
export { buildWaffleHtml } from './builders/waffle.js';
export { buildTreemapHtml } from './builders/treemap.js';
export { buildLineHtml } from './builders/line.js';
export { buildAreaHtml } from './builders/area.js';
export { buildSmallMultiplesHtml } from './builders/small-multiples.js';
export { buildScatterHtml } from './builders/scatter.js';
export { buildSankeyHtml } from './builders/sankey.js';
export { buildBumpChartHtml } from './builders/bump-chart.js';
export { buildConnectedDotPlotHtml } from './builders/connected-dot-plot.js';
export { buildChoroplethHtml } from './builders/choropleth.js';
export { buildProportionalSymbolHtml } from './builders/proportional-symbol.js';
export { buildViolinHtml } from './builders/violin.js';
export { buildRidgelineHtml } from './builders/ridgeline.js';
export { buildSunburstHtml } from './builders/sunburst.js';
export { buildSparklineGridHtml } from './builders/sparkline-grid.js';
export { buildCalendarHeatmapHtml } from './builders/calendar-heatmap.js';
export { buildConnectedScatterHtml } from './builders/connected-scatter.js';
export { buildParallelCoordinatesHtml } from './builders/parallel-coordinates.js';
export { buildRadarHtml } from './builders/radar.js';
export { buildAlluvialHtml } from './builders/alluvial.js';
export { buildChordHtml } from './builders/chord.js';
export { buildHeatmapHtml } from './builders/heatmap.js';
export { buildCirclePackHtml } from './builders/circle-pack.js';
export { buildMetricHtml } from './builders/metric.js';
export { buildDonutHtml } from './builders/donut.js';
export { buildBoxPlotHtml } from './builders/box-plot.js';
export { buildLollipopHtml } from './builders/lollipop.js';
export { buildBulletHtml } from './builders/bullet.js';
export { buildDensityPlotHtml } from './builders/density-plot.js';
export { buildMarimekkoHtml } from './builders/marimekko.js';
export { buildIcicleHtml } from './builders/icicle.js';
export { buildStreamGraphHtml } from './builders/stream-graph.js';
export { buildHorizonChartHtml } from './builders/horizon-chart.js';
export { buildFunnelHtml } from './builders/funnel.js';
export { buildGroupedBarHtml } from './builders/grouped-bar.js';
export { buildWaterfallHtml } from './builders/waterfall.js';
export { buildCompoundHtml } from './builders/compound.js';
export { shouldCompound, buildCompoundSpec } from './compound.js';
export { getPreferredHeight } from './sizing.js';
//# sourceMappingURL=index.d.ts.map