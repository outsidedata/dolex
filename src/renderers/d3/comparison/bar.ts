/**
 * Bar chart D3 renderer with adaptive sizing and smart hover targets.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  buildColorScale,
  addSortControls,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  styleAxis,
  getAdaptiveTickCount,
  calculateLeftMargin,
  shouldRotateLabels,
  calculateBottomMargin,
  truncateLabel,
  shouldShowValueLabels,
  renderEmptyState,
  isAllZeros,
  TEXT_MUTED,
  AXIS_COLOR,
  GRID_COLOR,
} from '../shared.js';

declare const d3: any;

export function renderBar(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const isHorizontal = config.orientation === 'horizontal';

  // Filter out rows with NaN y-values
  const yFieldName = encoding.y?.field;
  let sortedData = yFieldName
    ? [...data].filter((d) => !isNaN(Number(d[yFieldName])))
    : [...data];

  // Aggregate duplicate categories: if the same x-value appears multiple times, sum y-values
  if (encoding.x?.field && yFieldName) {
    const xKey = encoding.x.field;
    const categorySet = new Set(sortedData.map((d) => d[xKey]));
    if (categorySet.size < sortedData.length) {
      const aggregated = new Map<any, Record<string, any>>();
      for (const row of sortedData) {
        const key = row[xKey];
        if (aggregated.has(key)) {
          const existing = aggregated.get(key)!;
          existing[yFieldName] = Number(existing[yFieldName]) + Number(row[yFieldName]);
        } else {
          aggregated.set(key, { ...row });
        }
      }
      sortedData = [...aggregated.values()];
    }
  }

  // Sort by value
  if (config.sortBy === 'value' && encoding.y) {
    const yField = encoding.y.field;
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    sortedData.sort((a, b) => order * (Number(a[yField]) - Number(b[yField])));
  }

  // Sort by category (alphabetical)
  if (config.sortBy === 'category' && encoding.x) {
    const xField = encoding.x.field;
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    sortedData.sort((a, b) => {
      const aVal = String(a[xField]);
      const bVal = String(b[xField]);
      return order * aVal.localeCompare(bVal, undefined, { sensitivity: 'base', numeric: true });
    });
  }

  // Calculate dynamic margins
  let marginOverrides;
  if (isHorizontal) {
    const yField = encoding.x!.field;
    const labels = sortedData.map((d) => d[yField]);
    const leftMargin = calculateLeftMargin(labels);
    marginOverrides = { left: leftMargin, bottom: 40 };
  } else {
    // Calculate bottom margin for vertical bars based on label length and rotation
    const xField = encoding.x!.field;
    const labels = sortedData.map((d) => d[xField]);
    // Pre-calculate if rotation will be needed (needs rough estimate of bar width)
    const containerWidth = container.clientWidth || 800;
    const estimatedBarWidth = (containerWidth - 140) / labels.length; // Rough estimate
    const willRotate = shouldRotateLabels(labels, estimatedBarWidth);
    const bottomMargin = calculateBottomMargin(labels, willRotate);
    marginOverrides = { bottom: bottomMargin, left: 70 };
  }

  const { svg, g, dims } = createSvg(container, spec, marginOverrides);
  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (isAllZeros(data, encoding.y!.field)) {
    renderEmptyState(g, dims);
    return;
  }

  if (isHorizontal) {
    renderHorizontalBar(g, sortedData, data, encoding, config, dims, tooltip);
  } else {
    renderVerticalBar(g, sortedData, data, encoding, config, dims, tooltip);
  }

  // Add interactive sort controls in bottom-left corner (if categorical data)
  const xField = encoding.x?.field;
  const hasCategoricalLabels = xField && sortedData.some(d => {
    const value = d[xField];
    return typeof value === 'string' && isNaN(Number(value));
  });

  if (hasCategoricalLabels) {
    addSortControls(svg, container, spec, dims, renderBar);
  }
}

function renderHorizontalBar(
  g: any,
  data: Record<string, any>[],
  originalData: Record<string, any>[],
  encoding: VisualizationSpec['encoding'],
  config: VisualizationSpec['config'],
  dims: any,
  tooltip: HTMLDivElement
): void {
  const yField = encoding.x!.field; // category on y
  const xField = encoding.y!.field; // value on x

  const categories = data.map((d) => d[yField]);
  const yScale = d3.scaleBand().domain(categories).range([0, dims.innerHeight]).padding(0.2);

  const allVals = data.map((d: any) => Number(d[xField]));
  const minVal = d3.min(allVals) as number;
  const maxVal = d3.max(allVals) as number;
  const xScale = d3.scaleLinear().domain([Math.min(0, minVal), Math.max(0, maxVal)]).range([0, dims.innerWidth]).nice();

  const colorScale = buildColorScale(encoding.color, originalData, xField);

  // Adaptive tick count for x-axis
  const xTickCount = getAdaptiveTickCount(dims.innerWidth);

  // Draw x-axis with adaptive ticks and formatted values
  const xAxis = g
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${dims.innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .ticks(xTickCount)
        .tickSize(-dims.innerHeight)
        .tickPadding(8)
        .tickFormat((d: number) => formatValue(d))
    );

  styleAxis(xAxis);

  // Draw y-axis (categorical) with truncated labels
  const yAxis = g
    .append('g')
    .attr('class', 'y-axis')
    .call(
      d3
        .axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat((d: string) => truncateLabel(d, 25))
    );

  styleAxis(yAxis);

  // Clamp bar height for single/few items
  const maxBarHeight = Math.min(80, dims.innerHeight * 0.3);
  const barHeight = Math.min(yScale.bandwidth(), maxBarHeight);
  const barYOffset = (yScale.bandwidth() - barHeight) / 2;

  // Draw invisible hover targets for small bars
  g.selectAll('.bar-hover-target')
    .data(data)
    .join('rect')
    .attr('class', 'bar-hover-target')
    .attr('y', (d: any) => yScale(d[yField]))
    .attr('x', 0)
    .attr('height', yScale.bandwidth())
    .attr('width', dims.innerWidth)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      g.selectAll('.bar')
        .filter((bd: any) => bd[yField] === d[yField])
        .attr('opacity', 0.8);

      showTooltip(
        tooltip,
        `<strong>${d[yField]}</strong><br/>${xField}: ${formatValue(Number(d[xField]))}`,
        event
      );
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      g.selectAll('.bar').attr('opacity', 1);
      hideTooltip(tooltip);
    });

  // Draw bars
  g.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('y', (d: any) => yScale(d[yField]) + barYOffset)
    .attr('x', (d: any) => {
      const v = Number(d[xField]);
      return v >= 0 ? xScale(0) : xScale(v);
    })
    .attr('height', barHeight)
    .attr('width', (d: any) => Math.max(2, Math.abs(xScale(Number(d[xField])) - xScale(0))))
    .attr('fill', (d: any) => colorScale(d[encoding.color?.field || yField]))
    .attr('rx', 3)
    .attr('pointer-events', 'none'); // Let hover targets handle interaction
    // Animation disabled for snappy rendering (was: .transition().duration(600))

  // Value labels on bars (auto-enabled for large enough bars)
  const showLabels = shouldShowValueLabels(config, barHeight, true);
  if (showLabels) {
    g.selectAll('.bar-label')
      .data(data)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (d: any) => {
        const v = Number(d[xField]);
        const bw = Math.abs(xScale(v) - xScale(0));
        if (v >= 0) {
          return bw > 50 ? xScale(v) - 5 : xScale(v) + 8;
        } else {
          return bw > 50 ? xScale(v) + 5 : xScale(v) - 8;
        }
      })
      .attr('y', (d: any) => yScale(d[yField])! + yScale.bandwidth() / 2)
      .attr('text-anchor', (d: any) => {
        const v = Number(d[xField]);
        const barWidth = Math.abs(xScale(v) - xScale(0));
        if (v >= 0) return barWidth > 50 ? 'end' : 'start';
        return barWidth > 50 ? 'start' : 'end';
      })
      .attr('dominant-baseline', 'middle')
      .attr('fill', (d: any) => {
        const barWidth = Math.abs(xScale(Number(d[xField])) - xScale(0));
        return barWidth > 50 ? '#ffffff' : TEXT_MUTED;
      })
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .style('opacity', 1) // Instant (no animation)
      .text((d: any) => formatValue(Number(d[xField])));
      // Animation disabled for snappy rendering (was: .transition().delay(600).duration(200))
  }
}

function renderVerticalBar(
  g: any,
  data: Record<string, any>[],
  originalData: Record<string, any>[],
  encoding: VisualizationSpec['encoding'],
  config: VisualizationSpec['config'],
  dims: any,
  tooltip: HTMLDivElement
): void {
  const xField = encoding.x!.field;
  const yField = encoding.y!.field;

  const categories = data.map((d) => d[xField]);
  const xScale = d3.scaleBand().domain(categories).range([0, dims.innerWidth]).padding(0.2);

  const allValsV = data.map((d: any) => Number(d[yField]));
  const minValV = d3.min(allValsV) as number;
  const maxValV = d3.max(allValsV) as number;
  const yScale = d3
    .scaleLinear()
    .domain([Math.min(0, minValV), Math.max(0, maxValV)])
    .range([dims.innerHeight, 0])
    .nice();

  const colorScale = buildColorScale(encoding.color, originalData, yField);

  // Adaptive tick count for y-axis
  const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);

  // Draw x-axis (categorical) with truncated labels
  const xAxis = g
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${dims.innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat((d: string) => truncateLabel(d, 25))
    );

  styleAxis(xAxis);

  // Smart label rotation based on bar width and label length
  const bandwidth = xScale.bandwidth();
  const needsRotation = shouldRotateLabels(categories, bandwidth);

  if (needsRotation) {
    g.selectAll('.x-axis .tick text')
      .attr('transform', 'rotate(-35)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em');
  }

  // Draw y-axis with adaptive ticks and formatted values
  const yAxis = g
    .append('g')
    .attr('class', 'y-axis')
    .call(
      d3
        .axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8)
        .tickFormat((d: number) => formatValue(d))
    );

  styleAxis(yAxis);

  // Clamp bar width for single/few items to prevent oversized bars
  const maxBarWidth = Math.min(80, dims.innerWidth * 0.3);
  const barWidth = Math.min(xScale.bandwidth(), maxBarWidth);
  const barXOffset = (xScale.bandwidth() - barWidth) / 2;

  // Draw invisible hover targets for small bars
  g.selectAll('.bar-hover-target')
    .data(data)
    .join('rect')
    .attr('class', 'bar-hover-target')
    .attr('x', (d: any) => xScale(d[xField]))
    .attr('y', 0)
    .attr('width', xScale.bandwidth())
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      g.selectAll('.bar')
        .filter((bd: any) => bd[xField] === d[xField])
        .attr('opacity', 0.8);

      showTooltip(
        tooltip,
        `<strong>${d[xField]}</strong><br/>${yField}: ${formatValue(Number(d[yField]))}`,
        event
      );
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      g.selectAll('.bar').attr('opacity', 1);
      hideTooltip(tooltip);
    });

  // Draw bars
  g.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d: any) => xScale(d[xField]) + barXOffset)
    .attr('y', (d: any) => {
      const v = Number(d[yField]);
      return v >= 0 ? yScale(v) : yScale(0);
    })
    .attr('width', barWidth)
    .attr('height', (d: any) => Math.max(2, Math.abs(yScale(0) - yScale(Number(d[yField])))))
    .attr('fill', (d: any) => colorScale(d[encoding.color?.field || xField]))
    .attr('rx', 3)
    .attr('pointer-events', 'none');
    // Animation disabled for snappy rendering (was: .transition().duration(600))

  // Value labels on bars (auto-enabled for large enough bars)
  const showLabels = shouldShowValueLabels(config, barWidth, false);
  if (showLabels) {
    g.selectAll('.bar-label')
      .data(data)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (d: any) => xScale(d[xField])! + xScale.bandwidth() / 2)
      .attr('y', (d: any) => {
        const v = Number(d[yField]);
        const barHeight = Math.abs(yScale(0) - yScale(v));
        if (v >= 0) {
          return barHeight < 20 ? yScale(v) - 6 : yScale(v) + 14;
        } else {
          return barHeight < 20 ? yScale(0) + barHeight + 14 : yScale(0) + 14;
        }
      })
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any) => {
        const barHeight = Math.abs(yScale(0) - yScale(Number(d[yField])));
        return barHeight < 20 ? TEXT_MUTED : '#ffffff';
      })
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .style('opacity', 1) // Instant (no animation)
      .text((d: any) => formatValue(Number(d[yField])));
      // Animation disabled for snappy rendering (was: .transition().delay(600).duration(200))
  }
}
