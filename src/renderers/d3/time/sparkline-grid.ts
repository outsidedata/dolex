/**
 * Sparkline Grid D3 renderer
 *
 * Renders a compact grid of minimal line charts (sparklines).
 * Each sparkline shows the trend of one series without axes or gridlines.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  isAllZeros,
  TEXT_COLOR,
  TEXT_MUTED,
  truncateTitle,
  smartTruncateLabels,
} from '../shared.js';

declare const d3: any;

export function renderSparklineGrid(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  const timeField = config.timeField || encoding.x?.field;
  const valueField = config.valueField || encoding.y?.field;
  const seriesField = config.seriesField || encoding.facet?.field;

  const strokeWidth = config.strokeWidth || 1;
  const curveType = config.curveType || 'curve'; // 'curve' | 'square'

  const showSeriesLabel = config.showSeriesLabel !== false;
  const showLatestValue = config.showLatestValue !== false;
  const showTrendIndicator = config.showTrendIndicator !== false;

  // Group data by series
  const seriesGroups = d3.group(data, (d: any) => d[seriesField]);
  const seriesNames = Array.from(seriesGroups.keys());

  // Responsive grid sizing based on container
  const containerWidth = container.clientWidth || 800;
  const containerHeight = container.clientHeight || 500;
  const titleHeight = spec.title ? 40 : 0;
  const padding = 12;

  const numSeries = seriesNames.length;
  const gridCols = config.gridCols || Math.min(numSeries, Math.ceil(Math.sqrt(numSeries * (containerWidth / containerHeight))));
  const gridRows = Math.ceil(numSeries / gridCols);

  const minCellHeight = 45;
  const cellWidth = config.cellWidth || Math.floor((containerWidth - padding * (gridCols + 1)) / gridCols);
  const cellHeight = Math.max(minCellHeight, config.cellHeight || Math.floor((containerHeight - titleHeight - padding * (gridRows + 1)) / gridRows));

  const width = containerWidth;
  const height = containerHeight;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', '#0f1117')
    .style('border-radius', '8px');

  // Title
  if (spec.title) {
    const titleEl = svg.append('text')
      .attr('x', width / 2)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(spec.title);
    truncateTitle(titleEl, spec.title, width - 20);
  }

  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (isAllZeros(data, valueField)) {
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '14px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('All values are zero');
    return;
  }

  // Render each sparkline
  seriesNames.forEach((seriesName, idx) => {
    const row = Math.floor(idx / gridCols);
    const col = idx % gridCols;
    const x = col * (cellWidth + padding) + padding;
    const y = row * (cellHeight + padding) + padding + titleHeight;

    const seriesData = seriesGroups.get(seriesName)!
      .sort((a: any, b: any) => new Date(a[timeField]).getTime() - new Date(b[timeField]).getTime());

    const g = svg.append('g')
      .attr('transform', `translate(${x}, ${y})`);

    const values = seriesData.map((d: any) => Number(d[valueField]));
    const latestValue = values[values.length - 1];
    const previousValue = values[values.length - 2] || latestValue;
    const isUp = latestValue >= previousValue;
    const lineColor = isUp ? '#3dd9a0' : '#ff6b5e';

    // Background
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', cellWidth)
      .attr('height', cellHeight)
      .attr('fill', '#1a1d29')
      .attr('rx', 4);

    if (showSeriesLabel) {
      const maxChars = Math.max(3, Math.floor(cellWidth / 7));
      const allLabels = seriesNames.map(String);
      const smartLabels = smartTruncateLabels(allLabels, maxChars);
      const cellLabel = smartLabels[idx];
      g.append('text')
        .attr('x', 6)
        .attr('y', 12)
        .attr('text-anchor', 'start')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '10px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('opacity', 0.7)
        .text(cellLabel);
    }

    const sparkPadTop = showSeriesLabel ? 16 : 4;
    const sparkPadBot = showLatestValue ? 14 : 4;
    const sparkPadLeft = 4;
    const sparkPadRight = 4;

    if (seriesData.length <= 1) {
      const val = values.length > 0 ? values[0] : 0;

      g.append('circle')
        .attr('cx', cellWidth / 2)
        .attr('cy', cellHeight / 2)
        .attr('r', 5)
        .attr('fill', lineColor);

      g.append('text')
        .attr('x', cellWidth / 2)
        .attr('y', cellHeight / 2 - 12)
        .attr('text-anchor', 'middle')
        .attr('fill', lineColor)
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .attr('font-family', 'monospace')
        .text(formatValue(val));
    } else {
      const xScale = d3.scaleTime()
        .domain(d3.extent(seriesData, (d: any) => new Date(d[timeField])))
        .range([sparkPadLeft, cellWidth - sparkPadRight]);

      const yExtent = d3.extent(values) as [number, number];
      const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;
      const yScale = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .range([cellHeight - sparkPadBot, sparkPadTop]);

      // Line path
      const curve = curveType === 'square' ? d3.curveStepAfter
        : curveType === 'monotone' ? d3.curveMonotoneX
        : d3.curveBasis;
      const line = d3.line()
        .curve(curve)
        .x((d: any) => xScale(new Date(d[timeField])))
        .y((d: any) => yScale(Number(d[valueField])));

      g.append('path')
        .datum(seriesData)
        .attr('fill', 'none')
        .attr('stroke', lineColor)
        .attr('stroke-width', strokeWidth)
        .attr('d', line);

      // Latest value
      if (showLatestValue) {
        g.append('text')
          .attr('x', cellWidth)
          .attr('y', yScale(latestValue) + 3)
          .attr('text-anchor', 'end')
          .attr('fill', lineColor)
          .attr('font-size', '9px')
          .attr('font-weight', '600')
          .attr('font-family', 'monospace')
          .text(formatValue(latestValue));
      }

      // Trend indicator
      if (showTrendIndicator) {
        g.append('text')
          .attr('x', cellWidth - 2)
          .attr('y', 10)
          .attr('text-anchor', 'end')
          .attr('fill', lineColor)
          .attr('font-size', '8px')
          .text(isUp ? '▲' : '▼');
      }
    }

    // Hover interaction
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', cellWidth)
      .attr('height', cellHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseover', (event: MouseEvent) => {
        const change = latestValue - previousValue;
        const changePercent = previousValue !== 0 ? (change / previousValue * 100).toFixed(1) : '0';
        showTooltip(
          tooltip,
          `<strong>${seriesName}</strong><br/>` +
          `Latest: ${formatValue(latestValue)}<br/>` +
          `Change: ${change >= 0 ? '+' : ''}${formatValue(change)} (${changePercent}%)`,
          event
        );
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', () => hideTooltip(tooltip));
  });
}
