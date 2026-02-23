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
import { buildHtml } from './template.js';
import { buildBarHtml } from './builders/bar.js';
import { buildDivergingBarHtml } from './builders/diverging-bar.js';
import { buildSlopeChartHtml } from './builders/slope-chart.js';
import { buildHistogramHtml } from './builders/histogram.js';
import { buildBeeswarmHtml } from './builders/beeswarm.js';
import { buildStripPlotHtml } from './builders/strip-plot.js';
import { buildStackedBarHtml } from './builders/stacked-bar.js';
import { buildWaffleHtml } from './builders/waffle.js';
import { buildTreemapHtml } from './builders/treemap.js';
import { buildLineHtml } from './builders/line.js';
import { buildAreaHtml } from './builders/area.js';
import { buildSmallMultiplesHtml } from './builders/small-multiples.js';
import { buildScatterHtml } from './builders/scatter.js';
import { buildSankeyHtml } from './builders/sankey.js';
import { buildBumpChartHtml } from './builders/bump-chart.js';
import { buildConnectedDotPlotHtml } from './builders/connected-dot-plot.js';
import { buildChoroplethHtml } from './builders/choropleth.js';
import { buildProportionalSymbolHtml } from './builders/proportional-symbol.js';
import { buildViolinHtml } from './builders/violin.js';
import { buildRidgelineHtml } from './builders/ridgeline.js';
import { buildSunburstHtml } from './builders/sunburst.js';
import { buildSparklineGridHtml } from './builders/sparkline-grid.js';
import { buildCalendarHeatmapHtml } from './builders/calendar-heatmap.js';
import { buildConnectedScatterHtml } from './builders/connected-scatter.js';
import { buildParallelCoordinatesHtml } from './builders/parallel-coordinates.js';
import { buildRadarHtml } from './builders/radar.js';
import { buildAlluvialHtml } from './builders/alluvial.js';
import { buildChordHtml } from './builders/chord.js';
import { buildHeatmapHtml } from './builders/heatmap.js';
import { buildCirclePackHtml } from './builders/circle-pack.js';
import { buildMetricHtml } from './builders/metric.js';
import { buildDonutHtml } from './builders/donut.js';
import { buildBoxPlotHtml } from './builders/box-plot.js';
import { buildLollipopHtml } from './builders/lollipop.js';
import { buildBulletHtml } from './builders/bullet.js';
import { buildDensityPlotHtml } from './builders/density-plot.js';
import { buildMarimekkoHtml } from './builders/marimekko.js';
import { buildIcicleHtml } from './builders/icicle.js';
import { buildStreamGraphHtml } from './builders/stream-graph.js';
import { buildHorizonChartHtml } from './builders/horizon-chart.js';
import { buildFunnelHtml } from './builders/funnel.js';
import { buildGroupedBarHtml } from './builders/grouped-bar.js';
import { buildWaterfallHtml } from './builders/waterfall.js';
// ─── BUILDER DISPATCH MAP ───────────────────────────────────────────────────
const builders = {
    'bar': buildBarHtml,
    'diverging-bar': buildDivergingBarHtml,
    'slope-chart': buildSlopeChartHtml,
    'histogram': buildHistogramHtml,
    'beeswarm': buildBeeswarmHtml,
    'strip-plot': buildStripPlotHtml,
    'stacked-bar': buildStackedBarHtml,
    'waffle': buildWaffleHtml,
    'treemap': buildTreemapHtml,
    'line': buildLineHtml,
    'area': buildAreaHtml,
    'small-multiples': buildSmallMultiplesHtml,
    'scatter': buildScatterHtml,
    'sankey': buildSankeyHtml,
    'bump-chart': buildBumpChartHtml,
    'connected-dot-plot': buildConnectedDotPlotHtml,
    'choropleth': buildChoroplethHtml,
    'proportional-symbol': buildProportionalSymbolHtml,
    'violin': buildViolinHtml,
    'ridgeline': buildRidgelineHtml,
    'sunburst': buildSunburstHtml,
    'sparkline-grid': buildSparklineGridHtml,
    'calendar-heatmap': buildCalendarHeatmapHtml,
    'connected-scatter': buildConnectedScatterHtml,
    'parallel-coordinates': buildParallelCoordinatesHtml,
    'radar': buildRadarHtml,
    'alluvial': buildAlluvialHtml,
    'chord': buildChordHtml,
    'heatmap': buildHeatmapHtml,
    'circle-pack': buildCirclePackHtml,
    'metric': buildMetricHtml,
    'donut': buildDonutHtml,
    'box-plot': buildBoxPlotHtml,
    'lollipop': buildLollipopHtml,
    'bullet': buildBulletHtml,
    'density-plot': buildDensityPlotHtml,
    'marimekko': buildMarimekkoHtml,
    'icicle': buildIcicleHtml,
    'stream-graph': buildStreamGraphHtml,
    'horizon-chart': buildHorizonChartHtml,
    'funnel': buildFunnelHtml,
    'grouped-bar': buildGroupedBarHtml,
    'waterfall': buildWaterfallHtml,
};
// ─── PUBLIC API ─────────────────────────────────────────────────────────────
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
export function buildChartHtml(spec) {
    if (!spec || !spec.pattern) {
        return buildHtml({ pattern: 'error', title: 'Error', data: [], encoding: {}, config: {} }, `container.innerHTML = '<p style="color:#ef4444;padding:20px;">Invalid spec: missing pattern</p>';`);
    }
    if (!spec.data || spec.data.length === 0) {
        return buildHtml(spec, `container.innerHTML = '<p style="color:#ef4444;padding:20px;">No data provided</p>';`);
    }
    const builder = builders[spec.pattern];
    if (builder) {
        return builder(spec);
    }
    // Fallback: render a placeholder for unsupported patterns
    return buildPlaceholderHtml(spec);
}
/**
 * Get the list of pattern IDs that have HTML builders.
 */
export function getSupportedHtmlPatterns() {
    return Object.keys(builders);
}
/**
 * Check if a pattern has an HTML builder.
 */
export function isHtmlPatternSupported(pattern) {
    return pattern in builders;
}
// ─── PLACEHOLDER ────────────────────────────────────────────────────────────
function buildPlaceholderHtml(spec) {
    const columnCount = spec.data[0] ? Object.keys(spec.data[0]).length : 0;
    return buildHtml(spec, `
    var result = createSvg(container, spec);
    var g = result.g;
    var dims = result.dims;

    g.append('rect')
      .attr('x', dims.innerWidth / 2 - 160)
      .attr('y', dims.innerHeight / 2 - 50)
      .attr('width', 320)
      .attr('height', 100)
      .attr('rx', 8)
      .attr('fill', '#1e2028')
      .attr('stroke', '#2d3041')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', dims.innerWidth / 2)
      .attr('y', dims.innerHeight / 2 - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('Pattern: ' + spec.pattern);

    g.append('text')
      .attr('x', dims.innerWidth / 2)
      .attr('y', dims.innerHeight / 2 + 16)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '12px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(spec.data.length + ' rows, ${columnCount} columns');

    g.append('text')
      .attr('x', dims.innerWidth / 2)
      .attr('y', dims.innerHeight / 2 + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '11px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('HTML builder not yet implemented');
  `);
}
// ─── RE-EXPORTS ─────────────────────────────────────────────────────────────
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
//# sourceMappingURL=index.js.map