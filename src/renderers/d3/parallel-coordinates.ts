/**
 * Parallel Coordinates D3 renderer.
 *
 * Multiple vertical axes evenly spaced. Each data row draws a polyline
 * connecting its value on each axis. Lines can be colored by a categorical
 * grouping field. Best for comparing multivariate data across many dimensions.
 *
 * Standards: HTML legend below SVG, line-level hover, adaptive tick counts.
 */

import type { VisualizationSpec } from '../../types.js';
import {
  createSvg,
  buildColorScale,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  styleAxis,
  getAdaptiveTickCount,
  truncateLabel,
  createLegend,
  renderEmptyState,
  TEXT_COLOR,
  TEXT_MUTED,
} from './shared.js';
import type { LegendCallbacks } from './shared.js';
import { categorical } from '../../theme/colors.js';

declare const d3: any;

// ─── PARALLEL COORDINATES ────────────────────────────────────────────────────

export function renderParallelCoordinates(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  const dimensions: string[] = config.dimensions || [];
  const colorField = config.colorField || encoding.color?.field || null;
  const labelField = config.labelField || null;
  const lineOpacity = config.lineOpacity ?? 0.5;
  const strokeWidth = config.strokeWidth ?? 1.5;
  const showAxisLabels = config.showAxisLabels !== false;

  if (dimensions.length === 0 || data.length === 0) return;

  const hasLegend = colorField !== null;

  // ── Container layout: flex column with chartWrapper + legend ──
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';

  const chartWrapper = document.createElement('div');
  chartWrapper.style.cssText = 'flex: 1; min-height: 0;';
  container.appendChild(chartWrapper);

  const { svg, g, dims } = createSvg(chartWrapper, spec, {
    top: 50,
    bottom: 30,
    left: 60,
    right: 30,
  });
  const tooltip = createTooltip(container);

  // Check if all values across all dimensions are zero
  const allZero = dimensions.every(dim => data.every(d => Number(d[dim]) === 0));
  if (allZero) {
    svg.style('background', 'none');
    renderEmptyState(g, dims);
    return;
  }

  // Build a y-scale for each dimension
  const scales: Record<string, any> = {};
  for (const dim of dimensions) {
    const extent = d3.extent(data, (d: any) => Number(d[dim])) as [number, number];
    // Handle case where all values are the same
    const pad = extent[0] === extent[1] ? 1 : 0;
    scales[dim] = d3.scaleLinear()
      .domain([extent[0] - pad, extent[1] + pad])
      .range([dims.innerHeight, 0])
      .nice();
  }

  // Horizontal scale: position of each axis
  const xScale = d3.scalePoint()
    .domain(dimensions)
    .range([0, dims.innerWidth]);

  // Color scale — ensure field is present even when encoding.color only has palette
  const colorEncoding = colorField
    ? { ...(encoding.color || {}), field: colorField, type: encoding.color?.type || 'nominal' }
    : encoding.color;
  const colorScale = buildColorScale(colorEncoding, data);

  // Adaptive tick count per axis
  const tickCount = getAdaptiveTickCount(dims.innerHeight, 40);

  // ── Determine if tick labels should be hidden for tight spacing ──
  const axisSpacing = dimensions.length > 1
    ? dims.innerWidth / (dimensions.length - 1)
    : dims.innerWidth;
  const showTickLabels = showAxisLabels && axisSpacing >= 50;

  // ── Draw vertical axes using D3 axisLeft + styleAxis ──
  dimensions.forEach((dim: string, dimIdx: number) => {
    const x = xScale(dim);
    const yScale = scales[dim];

    const axisG = g.append('g')
      .attr('class', 'pc-axis')
      .attr('transform', `translate(${x}, 0)`)
      .call(
        d3.axisLeft(yScale)
          .ticks(tickCount)
          .tickSize(0)
          .tickPadding(6)
          .tickFormat((d: number) => formatValue(d))
      );

    styleAxis(axisG);

    // Hide tick labels when axes are too close together or explicitly disabled
    if (!showTickLabels) {
      axisG.selectAll('.tick text').remove();
    }

    // Dimension label at top
    g.append('text')
      .attr('x', x)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(truncateLabel(dim, 14));
  });

  // ── Build path string for a data row ──
  const pathForRow = (row: any): string => {
    return dimensions.map((dim: string, i: number) => {
      const x = xScale(dim);
      const y = scales[dim](Number(row[dim]));
      return (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
    }).join(' ');
  };

  // ── Draw polylines for each data row ──
  const lines = g.selectAll('.pc-line')
    .data(data)
    .join('path')
    .attr('class', 'pc-line')
    .attr('d', (d: any) => pathForRow(d))
    .attr('fill', 'none')
    .attr('stroke', (d: any) => colorField ? colorScale(d[colorField]) : categorical[0])
    .attr('stroke-width', strokeWidth)
    .attr('stroke-opacity', lineOpacity)
    .attr('stroke-linejoin', 'round')
    .style('cursor', 'pointer');

  // ── Hover interactions: highlight hovered line, dim others ──
  lines
    .on('mouseover', function (event: MouseEvent, d: any) {
      // Dim all lines
      g.selectAll('.pc-line')
        .attr('stroke-opacity', 0.08)
        .attr('stroke-width', strokeWidth * 0.5);

      // Highlight hovered line
      d3.select(this)
        .attr('stroke-opacity', 1)
        .attr('stroke-width', strokeWidth * 2.5)
        .raise();

      // Build tooltip with entity label + all dimension values
      let html = '';
      if (labelField && d[labelField]) {
        html += `<strong>${d[labelField]}</strong>`;
        if (colorField && colorField !== labelField) {
          html += ` <span style="color:#9ca3af">${d[colorField]}</span>`;
        }
        html += '<br/>';
      } else if (colorField) {
        html += `<strong>${d[colorField]}</strong><br/>`;
      }
      html += dimensions.map((dim: string) => {
        const val = Number(d[dim]);
        return `${dim}: ${isNaN(val) ? d[dim] : formatValue(val)}`;
      }).join('<br/>');

      showTooltip(tooltip, html, event);
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      // Restore all lines
      g.selectAll('.pc-line')
        .attr('stroke-opacity', lineOpacity)
        .attr('stroke-width', strokeWidth);

      hideTooltip(tooltip);
    });

  // ── HTML legend below chart with hover highlighting ──
  if (hasLegend) {
    const legendDiv = createLegend(colorScale, { shape: 'line', callbacks: {
      onHover: (category: string) => {
        g.selectAll('.pc-line').each(function (d: any) {
          const isMatch = d[colorField!] === category;
          d3.select(this)
            .attr('stroke-opacity', isMatch ? Math.min(lineOpacity * 2, 1) : 0.05)
            .attr('stroke-width', isMatch ? strokeWidth * 1.5 : strokeWidth * 0.5);
        });
      },
      onLeave: () => {
        g.selectAll('.pc-line')
          .attr('stroke-opacity', lineOpacity)
          .attr('stroke-width', strokeWidth);
      },
    }});
    container.appendChild(legendDiv);
  }
}
