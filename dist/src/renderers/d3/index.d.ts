/**
 * D3 Visualization Renderer — main entry point.
 *
 * Dispatches a VisualizationSpec to the correct renderer
 * based on the spec.pattern field. Unimplemented patterns show a
 * placeholder with data summary.
 */
import type { VisualizationSpec } from '../../types.js';
import { renderPlaceholder } from './shared.js';
import { renderBar } from './comparison/bar.js';
import { renderDivergingBar } from './comparison/diverging-bar.js';
import { renderSlopeChart } from './comparison/slope-chart.js';
import { renderConnectedDotPlot } from './comparison/connected-dot-plot.js';
import { renderBumpChart } from './comparison/bump-chart.js';
import { renderLollipop } from './comparison/lollipop.js';
import { renderBullet } from './comparison/bullet.js';
import { renderGroupedBar } from './comparison/grouped-bar.js';
import { renderWaterfall } from './comparison/waterfall.js';
import { renderHistogram } from './distribution/histogram.js';
import { renderBeeswarm } from './distribution/beeswarm.js';
import { renderStripPlot } from './distribution/strip-plot.js';
import { renderViolin } from './distribution/violin.js';
import { renderRidgeline } from './distribution/ridgeline.js';
import { renderBoxPlot } from './distribution/box-plot.js';
import { renderDensityPlot } from './distribution/density-plot.js';
import { renderStackedBar } from './composition/stacked-bar.js';
import { renderWaffle } from './composition/waffle.js';
import { renderTreemap } from './composition/treemap.js';
import { renderSunburst } from './composition/sunburst.js';
import { renderCirclePack } from './composition/circle-pack.js';
import { renderMetric } from './composition/metric.js';
import { renderDonut } from './composition/donut.js';
import { renderMarimekko } from './composition/marimekko.js';
import { renderIcicle } from './composition/icicle.js';
import { renderLine } from './time/line.js';
import { renderArea } from './time/area.js';
import { renderSmallMultiples } from './time/small-multiples.js';
import { renderSparklineGrid } from './time/sparkline-grid.js';
import { renderCalendarHeatmap } from './time/calendar-heatmap.js';
import { renderStreamGraph } from './time/stream-graph.js';
import { renderHorizonChart } from './time/horizon-chart.js';
import { renderScatter } from './relationship.js';
import { renderRadar } from './radar.js';
import { renderConnectedScatter } from './connected-scatter.js';
import { renderParallelCoordinates } from './parallel-coordinates.js';
import { renderHeatmap } from './heatmap.js';
import { renderSankey } from './flow/sankey.js';
import { renderAlluvial } from './flow/alluvial.js';
import { renderChord } from './flow/chord.js';
import { renderFunnel } from './flow/funnel.js';
import { renderChoropleth } from './geo/choropleth.js';
import { renderProportionalSymbol } from './geo/proportional-symbol.js';
/**
 * Render a VisualizationSpec into a container element using D3.
 *
 * Clears the container, then dispatches to the appropriate renderer
 * based on `spec.pattern`. If the pattern is not yet implemented,
 * renders a placeholder with the pattern name and data summary.
 */
export declare function renderSpec(container: HTMLElement, spec: VisualizationSpec): void;
/**
 * Get the list of supported (implemented) pattern IDs.
 */
export declare function getSupportedPatterns(): string[];
/**
 * Check if a pattern has a renderer implementation.
 */
export declare function isPatternSupported(pattern: string): boolean;
export { renderBar, renderDivergingBar, renderSlopeChart, renderConnectedDotPlot, renderBumpChart, renderHistogram, renderBeeswarm, renderStripPlot, renderViolin, renderRidgeline, renderBoxPlot, renderStackedBar, renderWaffle, renderTreemap, renderSunburst, renderCirclePack, renderMetric, renderDonut, renderLine, renderArea, renderSmallMultiples, renderSparklineGrid, renderCalendarHeatmap, renderScatter, renderRadar, renderConnectedScatter, renderParallelCoordinates, renderHeatmap, renderSankey, renderAlluvial, renderChord, renderFunnel, renderLollipop, renderBullet, renderDensityPlot, renderMarimekko, renderIcicle, renderStreamGraph, renderHorizonChart, renderChoropleth, renderProportionalSymbol, renderGroupedBar, renderWaterfall, renderPlaceholder, };
//# sourceMappingURL=index.d.ts.map