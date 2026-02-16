/**
 * D3 Visualization Renderer — main entry point.
 *
 * Dispatches a VisualizationSpec to the correct renderer
 * based on the spec.pattern field. Unimplemented patterns show a
 * placeholder with data summary.
 */

import type { VisualizationSpec } from '../../types.js';
import { renderPlaceholder } from './shared.js';

// Comparison
import { renderBar } from './comparison/bar.js';
import { renderDivergingBar } from './comparison/diverging-bar.js';
import { renderSlopeChart } from './comparison/slope-chart.js';
import { renderConnectedDotPlot } from './comparison/connected-dot-plot.js';
import { renderBumpChart } from './comparison/bump-chart.js';
import { renderLollipop } from './comparison/lollipop.js';
import { renderBullet } from './comparison/bullet.js';
import { renderGroupedBar } from './comparison/grouped-bar.js';
import { renderWaterfall } from './comparison/waterfall.js';

// Distribution
import { renderHistogram } from './distribution/histogram.js';
import { renderBeeswarm } from './distribution/beeswarm.js';
import { renderStripPlot } from './distribution/strip-plot.js';
import { renderViolin } from './distribution/violin.js';
import { renderRidgeline } from './distribution/ridgeline.js';
import { renderBoxPlot } from './distribution/box-plot.js';
import { renderDensityPlot } from './distribution/density-plot.js';

// Composition
import { renderStackedBar } from './composition/stacked-bar.js';
import { renderWaffle } from './composition/waffle.js';
import { renderTreemap } from './composition/treemap.js';
import { renderSunburst } from './composition/sunburst.js';
import { renderCirclePack } from './composition/circle-pack.js';
import { renderMetric } from './composition/metric.js';
import { renderDonut } from './composition/donut.js';
import { renderMarimekko } from './composition/marimekko.js';
import { renderIcicle } from './composition/icicle.js';

// Time
import { renderLine } from './time/line.js';
import { renderArea } from './time/area.js';
import { renderSmallMultiples } from './time/small-multiples.js';
import { renderSparklineGrid } from './time/sparkline-grid.js';
import { renderCalendarHeatmap } from './time/calendar-heatmap.js';
import { renderStreamGraph } from './time/stream-graph.js';
import { renderHorizonChart } from './time/horizon-chart.js';

// Relationship
import { renderScatter } from './relationship.js';
import { renderRadar } from './radar.js';
import { renderConnectedScatter } from './connected-scatter.js';
import { renderParallelCoordinates } from './parallel-coordinates.js';
import { renderHeatmap } from './heatmap.js';

// Flow
import { renderSankey } from './flow/sankey.js';
import { renderAlluvial } from './flow/alluvial.js';
import { renderChord } from './flow/chord.js';
import { renderFunnel } from './flow/funnel.js';

// Geo
import { renderChoropleth } from './geo/choropleth.js';
import { renderProportionalSymbol } from './geo/proportional-symbol.js';

// ─── PATTERN DISPATCH MAP ────────────────────────────────────────────────────

const renderers: Record<string, (container: HTMLElement, spec: VisualizationSpec) => void> = {
  // Comparison
  'bar': renderBar,
  'diverging-bar': renderDivergingBar,
  'slope-chart': renderSlopeChart,
  'connected-dot-plot': renderConnectedDotPlot,
  'bump-chart': renderBumpChart,
  'lollipop': renderLollipop,
  'bullet': renderBullet,
  'grouped-bar': renderGroupedBar,
  'waterfall': renderWaterfall,

  // Distribution
  'histogram': renderHistogram,
  'beeswarm': renderBeeswarm,
  'strip-plot': renderStripPlot,
  'violin': renderViolin,
  'ridgeline': renderRidgeline,
  'box-plot': renderBoxPlot,
  'density-plot': renderDensityPlot,

  // Composition
  'stacked-bar': renderStackedBar,
  'waffle': renderWaffle,
  'treemap': renderTreemap,
  'sunburst': renderSunburst,
  'circle-pack': renderCirclePack,
  'metric': renderMetric,
  'donut': renderDonut,
  'marimekko': renderMarimekko,
  'icicle': renderIcicle,

  // Time
  'line': renderLine,
  'area': renderArea,
  'small-multiples': renderSmallMultiples,
  'sparkline-grid': renderSparklineGrid,
  'calendar-heatmap': renderCalendarHeatmap,
  'stream-graph': renderStreamGraph,
  'horizon-chart': renderHorizonChart,

  // Relationship
  'scatter': renderScatter,
  'radar': renderRadar,
  'connected-scatter': renderConnectedScatter,
  'parallel-coordinates': renderParallelCoordinates,
  'heatmap': renderHeatmap,

  // Flow
  'sankey': renderSankey,
  'alluvial': renderAlluvial,
  'chord': renderChord,
  'funnel': renderFunnel,

  // Geo
  'choropleth': renderChoropleth,
  'proportional-symbol': renderProportionalSymbol,
};

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Render a VisualizationSpec into a container element using D3.
 *
 * Clears the container, then dispatches to the appropriate renderer
 * based on `spec.pattern`. If the pattern is not yet implemented,
 * renders a placeholder with the pattern name and data summary.
 */
export function renderSpec(container: HTMLElement, spec: VisualizationSpec): void {
  container.innerHTML = '';

  if (!spec || !spec.pattern) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">Invalid spec: missing pattern</p>';
    return;
  }

  if (!spec.data || spec.data.length === 0) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">No data provided</p>';
    return;
  }

  const renderer = renderers[spec.pattern];
  if (renderer) {
    try {
      renderer(container, spec);
    } catch (err) {
      console.error(`Renderer error for pattern "${spec.pattern}":`, err);
      container.innerHTML = `
        <div style="color:#ef4444;padding:20px;font-family:monospace;">
          <p><strong>Render error:</strong> ${spec.pattern}</p>
          <pre style="font-size:11px;opacity:0.8;white-space:pre-wrap;">${(err as Error).message}\n${(err as Error).stack}</pre>
        </div>
      `;
    }
  } else {
    renderPlaceholder(container, spec);
  }
}

/**
 * Get the list of supported (implemented) pattern IDs.
 */
export function getSupportedPatterns(): string[] {
  return Object.keys(renderers);
}

/**
 * Check if a pattern has a renderer implementation.
 */
export function isPatternSupported(pattern: string): boolean {
  return pattern in renderers;
}

// Re-export individual renderers for direct use
export {
  renderBar,
  renderDivergingBar,
  renderSlopeChart,
  renderConnectedDotPlot,
  renderBumpChart,
  renderHistogram,
  renderBeeswarm,
  renderStripPlot,
  renderViolin,
  renderRidgeline,
  renderBoxPlot,
  renderStackedBar,
  renderWaffle,
  renderTreemap,
  renderSunburst,
  renderCirclePack,
  renderMetric,
  renderDonut,
  renderLine,
  renderArea,
  renderSmallMultiples,
  renderSparklineGrid,
  renderCalendarHeatmap,
  renderScatter,
  renderRadar,
  renderConnectedScatter,
  renderParallelCoordinates,
  renderHeatmap,
  renderSankey,
  renderAlluvial,
  renderChord,
  renderFunnel,
  renderLollipop,
  renderBullet,
  renderDensityPlot,
  renderMarimekko,
  renderIcicle,
  renderStreamGraph,
  renderHorizonChart,
  renderChoropleth,
  renderProportionalSymbol,
  renderGroupedBar,
  renderWaterfall,
  renderPlaceholder,
};
