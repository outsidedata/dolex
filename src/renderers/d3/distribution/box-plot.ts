/**
 * Box Plot D3 renderer.
 *
 * Quartile summary chart: median, Q1/Q3 box, whiskers (IQR or min/max),
 * and outlier dots. Supports vertical and horizontal orientation.
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
  shouldRotateLabels,
  calculateBottomMargin,
  truncateLabel,
  renderEmptyState,
  TEXT_MUTED,
  DEFAULT_PALETTE,
} from '../shared.js';

declare const d3: any;

// ─── STAT HELPERS ──────────────────────────────────────────────────────────────

interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  whiskerLow: number;
  whiskerHigh: number;
  mean: number;
  outliers: number[];
  values: number[];
}

function computeBoxStats(values: number[], whiskerType: 'iqr' | 'minmax'): BoxStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const min = sorted[0];
  const max = sorted[n - 1];

  const median = n % 2 === 1
    ? sorted[Math.floor(n / 2)]
    : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));

  const q1 = lowerHalf.length % 2 === 1
    ? lowerHalf[Math.floor(lowerHalf.length / 2)]
    : lowerHalf.length > 0
      ? (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2
      : min;

  const q3 = upperHalf.length % 2 === 1
    ? upperHalf[Math.floor(upperHalf.length / 2)]
    : upperHalf.length > 0
      ? (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2
      : max;

  const iqr = q3 - q1;
  const mean = values.reduce((s, v) => s + v, 0) / n;

  let whiskerLow: number;
  let whiskerHigh: number;
  let outliers: number[];

  if (whiskerType === 'minmax') {
    whiskerLow = min;
    whiskerHigh = max;
    outliers = [];
  } else {
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    whiskerLow = sorted.find(v => v >= lowerFence) ?? min;
    whiskerHigh = [...sorted].reverse().find(v => v <= upperFence) ?? max;
    outliers = sorted.filter(v => v < lowerFence || v > upperFence);
  }

  return { min, q1, median, q3, max, iqr, whiskerLow, whiskerHigh, mean, outliers, values: sorted };
}

// ─── RENDERER ─────────────────────────────────────────────────────────────────

export function renderBoxPlot(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  const valueField = config.valueField || encoding.y?.field || Object.keys(data[0]).find(k => typeof data[0][k] === 'number') || Object.keys(data[0])[1];
  const categoryField = config.categoryField || encoding.x?.field || Object.keys(data[0])[0];
  const whiskerType: 'iqr' | 'minmax' = config.whiskerType || 'iqr';
  const showOutliers = config.showOutliers ?? true;
  const showMean = config.showMean ?? false;
  const horizontal = config.orientation === 'horizontal';

  let groups = [...new Set(data.map(d => d[categoryField]))];

  const groupStatsMap = new Map<string, BoxStats>();
  for (const group of groups) {
    const vals = data
      .filter(d => d[categoryField] === group)
      .map(d => Number(d[valueField]))
      .filter(v => !isNaN(v));
    if (vals.length >= 1) {
      groupStatsMap.set(String(group), computeBoxStats(vals, whiskerType));
    }
  }

  if (config.sortBy === 'value') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    groups.sort((a, b) => order * ((groupStatsMap.get(String(a))?.median ?? 0) - (groupStatsMap.get(String(b))?.median ?? 0)));
  } else if (config.sortBy === 'category') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    groups.sort((a, b) => order * String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }));
  }

  const allValues = data.map(d => Number(d[valueField])).filter(v => !isNaN(v));
  const labels = groups.map(String);

  // Margins depend on orientation
  let margins: { top?: number; right?: number; bottom?: number; left?: number };
  if (horizontal) {
    const maxLabelLen = Math.max(...labels.map(l => l.length));
    const leftMargin = Math.min(Math.max(maxLabelLen * 7, 70), 180);
    margins = { left: leftMargin, bottom: 40 };
  } else {
    const containerWidth = container.clientWidth || 800;
    const estimatedBandWidth = (containerWidth - 140) / labels.length;
    const needsRotation = shouldRotateLabels(labels, estimatedBandWidth);
    margins = { bottom: calculateBottomMargin(labels, needsRotation), left: 70 };
  }

  const { svg, g, dims } = createSvg(container, spec, margins);
  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (allValues.every(v => v === 0)) {
    renderEmptyState(g, dims);
    return;
  }

  const valuePadding = (d3.max(allValues)! - d3.min(allValues)!) * 0.08 || 1;

  // Scales — swap axes for horizontal
  const bandScale = d3
    .scaleBand()
    .domain(groups)
    .range(horizontal ? [0, dims.innerHeight] : [0, dims.innerWidth])
    .padding(0.25);

  const valueScale = d3
    .scaleLinear()
    .domain([d3.min(allValues)! - valuePadding, d3.max(allValues)! + valuePadding])
    .range(horizontal ? [0, dims.innerWidth] : [dims.innerHeight, 0])
    .nice();

  if (horizontal) {
    // Y-axis: categories
    const yAxis = g
      .append('g')
      .attr('class', 'y-axis')
      .call(
        d3
          .axisLeft(bandScale)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((d: string) => truncateLabel(d, 25))
      );
    styleAxis(yAxis);

    // X-axis: values with grid
    const xTickCount = getAdaptiveTickCount(dims.innerWidth, 60);
    const xAxis = g
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${dims.innerHeight})`)
      .call(
        d3
          .axisBottom(valueScale)
          .ticks(xTickCount)
          .tickSize(-dims.innerHeight)
          .tickPadding(8)
          .tickFormat((d: number) => formatValue(d))
      );
    styleAxis(xAxis);
  } else {
    // X-axis: categories
    const containerWidth = container.clientWidth || 800;
    const estimatedBandWidth = (containerWidth - 140) / labels.length;
    const needsRotation = shouldRotateLabels(labels, estimatedBandWidth);

    const xAxis = g
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${dims.innerHeight})`)
      .call(
        d3
          .axisBottom(bandScale)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((d: string) => truncateLabel(d, 25))
      );
    styleAxis(xAxis);

    if (needsRotation) {
      g.selectAll('.x-axis .tick text')
        .attr('transform', 'rotate(-35)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.15em');
    }

    // Y-axis: values with grid
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    const yAxis = g
      .append('g')
      .attr('class', 'y-axis')
      .call(
        d3
          .axisLeft(valueScale)
          .ticks(yTickCount)
          .tickSize(-dims.innerWidth)
          .tickPadding(8)
          .tickFormat((d: number) => formatValue(d))
      );
    styleAxis(yAxis);
  }

  const colorScale = buildColorScale(encoding.color, data);
  const bandWidth = bandScale.bandwidth();
  const boxWidth = Math.min(bandWidth * 0.4, 45);

  const groupDataArr = groups.map(group => ({
    group,
    stats: groupStatsMap.get(String(group)),
  }));

  // Hover targets
  g.selectAll('.box-hover-target')
    .data(groupDataArr)
    .join('rect')
    .attr('class', 'box-hover-target')
    .attr('x', (d: any) => horizontal ? 0 : bandScale(d.group))
    .attr('y', (d: any) => horizontal ? bandScale(d.group) : 0)
    .attr('width', horizontal ? dims.innerWidth : bandWidth)
    .attr('height', horizontal ? bandWidth : dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      const idx = groups.indexOf(d.group);
      g.selectAll(`.box-group-${idx}`)
        .attr('opacity', 1);

      if (!d.stats) return;
      const s = d.stats;
      let html = `<strong>${d.group}</strong><br/>` +
        `n = ${s.values.length}<br/>` +
        `Median: ${formatValue(s.median)}<br/>` +
        `Q1: ${formatValue(s.q1)}<br/>` +
        `Q3: ${formatValue(s.q3)}<br/>` +
        `IQR: ${formatValue(s.iqr)}`;
      if (showMean) html += `<br/>Mean: ${formatValue(s.mean)}`;
      if (showOutliers && s.outliers.length > 0) {
        html += `<br/>Outliers: ${s.outliers.length}`;
      }
      showTooltip(tooltip, html, event);
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function (_event: MouseEvent, d: any) {
      const idx = groups.indexOf(d.group);
      g.selectAll(`.box-group-${idx}`)
        .attr('opacity', 0.85);
      hideTooltip(tooltip);
    });

  // Draw each box plot
  groups.forEach((group, gi) => {
    const stats = groupStatsMap.get(String(group));
    if (!stats) return;

    const bandCenter = bandScale(group)! + bandWidth / 2;
    const colorValue = encoding.color?.field
      ? data.find(d => d[categoryField] === group)?.[encoding.color.field]
      : group;
    const fillColor = colorScale(colorValue);

    const groupG = g.append('g').attr('class', `box-group-${gi}`).attr('opacity', 0.85);

    if (horizontal) {
      // Whisker line (horizontal)
      groupG.append('line')
        .attr('x1', valueScale(stats.whiskerLow))
        .attr('x2', valueScale(stats.whiskerHigh))
        .attr('y1', bandCenter)
        .attr('y2', bandCenter)
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');

      // Whisker caps (vertical ticks)
      const capWidth = boxWidth * 0.5;
      [stats.whiskerLow, stats.whiskerHigh].forEach(val => {
        groupG.append('line')
          .attr('x1', valueScale(val))
          .attr('x2', valueScale(val))
          .attr('y1', bandCenter - capWidth / 2)
          .attr('y2', bandCenter + capWidth / 2)
          .attr('stroke', '#6b7280')
          .attr('stroke-width', 1.5)
          .attr('pointer-events', 'none');
      });

      // IQR box
      const boxLeft = valueScale(stats.q1);
      const boxRight = valueScale(stats.q3);
      groupG.append('rect')
        .attr('x', boxLeft)
        .attr('y', bandCenter - boxWidth / 2)
        .attr('width', Math.max(1, boxRight - boxLeft))
        .attr('height', boxWidth)
        .attr('fill', fillColor)
        .attr('stroke', 'none')
        .attr('rx', 3)
        .attr('pointer-events', 'none');

      // Median line (vertical)
      groupG.append('line')
        .attr('x1', valueScale(stats.median))
        .attr('x2', valueScale(stats.median))
        .attr('y1', bandCenter - boxWidth / 2)
        .attr('y2', bandCenter + boxWidth / 2)
        .attr('stroke', '#c8cdd5')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'none');

      // Mean marker
      if (showMean) {
        const mx = valueScale(stats.mean);
        const size = 4;
        groupG.append('path')
          .attr('d', `M${mx},${bandCenter - size} L${mx + size},${bandCenter} L${mx},${bandCenter + size} L${mx - size},${bandCenter} Z`)
          .attr('fill', '#c8cdd5')
          .attr('stroke', fillColor)
          .attr('stroke-width', 1)
          .attr('pointer-events', 'none');
      }

      // Outliers
      if (showOutliers && stats.outliers.length > 0) {
        groupG.selectAll('.outlier')
          .data(stats.outliers)
          .join('circle')
          .attr('class', 'outlier')
          .attr('cx', (d: number) => valueScale(d))
          .attr('cy', bandCenter)
          .attr('r', 3)
          .attr('fill', 'none')
          .attr('stroke', fillColor)
          .attr('stroke-width', 1.5)
          .attr('pointer-events', 'none');
      }
    } else {
      // Vertical orientation (original)

      // Whisker line
      groupG.append('line')
        .attr('x1', bandCenter)
        .attr('x2', bandCenter)
        .attr('y1', valueScale(stats.whiskerHigh))
        .attr('y2', valueScale(stats.whiskerLow))
        .attr('stroke', '#6b7280')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');

      // Whisker caps
      const capWidth = boxWidth * 0.5;
      [stats.whiskerLow, stats.whiskerHigh].forEach(val => {
        groupG.append('line')
          .attr('x1', bandCenter - capWidth / 2)
          .attr('x2', bandCenter + capWidth / 2)
          .attr('y1', valueScale(val))
          .attr('y2', valueScale(val))
          .attr('stroke', '#6b7280')
          .attr('stroke-width', 1.5)
          .attr('pointer-events', 'none');
      });

      // IQR box
      groupG.append('rect')
        .attr('x', bandCenter - boxWidth / 2)
        .attr('y', valueScale(stats.q3))
        .attr('width', boxWidth)
        .attr('height', Math.max(1, valueScale(stats.q1) - valueScale(stats.q3)))
        .attr('fill', fillColor)
        .attr('stroke', 'none')
        .attr('rx', 3)
        .attr('pointer-events', 'none');

      // Median line
      groupG.append('line')
        .attr('x1', bandCenter - boxWidth / 2)
        .attr('x2', bandCenter + boxWidth / 2)
        .attr('y1', valueScale(stats.median))
        .attr('y2', valueScale(stats.median))
        .attr('stroke', '#c8cdd5')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'none');

      // Mean marker
      if (showMean) {
        const my = valueScale(stats.mean);
        const size = 4;
        groupG.append('path')
          .attr('d', `M${bandCenter},${my - size} L${bandCenter + size},${my} L${bandCenter},${my + size} L${bandCenter - size},${my} Z`)
          .attr('fill', '#c8cdd5')
          .attr('stroke', fillColor)
          .attr('stroke-width', 1)
          .attr('pointer-events', 'none');
      }

      // Outliers
      if (showOutliers && stats.outliers.length > 0) {
        groupG.selectAll('.outlier')
          .data(stats.outliers)
          .join('circle')
          .attr('class', 'outlier')
          .attr('cx', bandCenter)
          .attr('cy', (d: number) => valueScale(d))
          .attr('r', 3)
          .attr('fill', 'none')
          .attr('stroke', fillColor)
          .attr('stroke-width', 1.5)
          .attr('pointer-events', 'none');
      }
    }
  });

  addSortControls(svg, container, spec, dims, renderBoxPlot);
}
