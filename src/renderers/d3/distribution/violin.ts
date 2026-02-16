/**
 * Violin plot D3 renderer.
 *
 * For each group, draws a mirrored KDE (kernel density estimate) shape.
 * Groups on X-axis, values on Y-axis. Each group shows the distribution
 * shape as a symmetric filled area.
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
  TEXT_MUTED,
} from '../shared.js';

declare const d3: any;

// ─── KDE HELPERS ──────────────────────────────────────────────────────────────

interface DensityPoint {
  value: number;
  density: number;
}

/** Gaussian kernel function. */
function gaussianKernel(u: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}

/** Compute standard deviation of a numeric array. */
function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 1;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/** Compute KDE for a set of values at the given sample points. */
function kde(
  values: number[],
  samplePoints: number[],
  bandwidth: number
): DensityPoint[] {
  const n = values.length;
  return samplePoints.map((x) => {
    const density =
      values.reduce((sum, xi) => sum + gaussianKernel((x - xi) / bandwidth), 0) /
      (n * bandwidth);
    return { value: x, density };
  });
}

/** Silverman's rule of thumb for bandwidth selection. */
function silvermanBandwidth(values: number[]): number {
  const sd = stdDev(values);
  const n = values.length;
  const bw = 1.06 * sd * Math.pow(n, -0.2);
  if (bw > 0) return bw;
  const range = (Math.max(...values) - Math.min(...values));
  return range > 0 ? range * 0.1 : 1;
}

/** Compute quartiles + median from sorted values. */
function quartiles(sorted: number[]): { q1: number; median: number; q3: number } {
  const n = sorted.length;
  if (n === 0) return { q1: 0, median: 0, q3: 0 };
  if (n === 1) return { q1: sorted[0], median: sorted[0], q3: sorted[0] };
  const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));
  const q1 =
    lowerHalf.length % 2 === 1
      ? lowerHalf[Math.floor(lowerHalf.length / 2)]
      : (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2;
  const q3 =
    upperHalf.length % 2 === 1
      ? upperHalf[Math.floor(upperHalf.length / 2)]
      : (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2;
  return { q1, median, q3 };
}

// ─── RENDERER ─────────────────────────────────────────────────────────────────

export function renderViolin(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const valueField = config.valueField || encoding.y?.field || Object.keys(data[0]).find((k) => typeof data[0][k] === 'number') || Object.keys(data[0])[1];
  const categoryField = config.categoryField || encoding.x?.field || Object.keys(data[0])[0];
  const showBoxPlot = config.showBoxPlot ?? false;
  const showMedian = config.showMedian ?? true;
  const showQuartiles = config.showQuartiles ?? false;
  const userBandwidth = typeof config.bandwidth === 'number' ? config.bandwidth : undefined;

  // Sort data if requested
  let groups = [...new Set(data.map((d) => d[categoryField]))];

  if (config.sortBy === 'value') {
    // Sort groups by median value
    const medianMap = new Map<string, number>();
    for (const group of groups) {
      const vals = data
        .filter((d) => d[categoryField] === group)
        .map((d) => Number(d[valueField]))
        .filter((v) => !isNaN(v))
        .sort((a, b) => a - b);
      medianMap.set(String(group), vals.length > 0 ? quartiles(vals).median : 0);
    }
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    groups.sort((a, b) => order * ((medianMap.get(String(a)) || 0) - (medianMap.get(String(b)) || 0)));
  } else if (config.sortBy === 'category') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    groups.sort((a, b) => order * String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }));
  }

  const allValues = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));

  // Calculate dynamic margins
  const labels = groups.map(String);
  const containerWidth = container.clientWidth || 800;
  const estimatedBandWidth = (containerWidth - 140) / labels.length;
  const needsRotation = shouldRotateLabels(labels, estimatedBandWidth);
  const bottomMargin = calculateBottomMargin(labels, needsRotation);

  const { svg, g, dims } = createSvg(container, spec, { bottom: bottomMargin, left: 70 });
  const tooltip = createTooltip(container);

  // Scales
  const xScale = d3
    .scaleBand()
    .domain(groups)
    .range([0, dims.innerWidth])
    .padding(0.1);

  const valuePadding = (d3.max(allValues)! - d3.min(allValues)!) * 0.05 || 1;
  const yScale = d3
    .scaleLinear()
    .domain([d3.min(allValues)! - valuePadding, d3.max(allValues)! + valuePadding])
    .range([dims.innerHeight, 0])
    .nice();

  // X-axis (categorical) with truncated labels
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

  if (needsRotation) {
    g.selectAll('.x-axis .tick text')
      .attr('transform', 'rotate(-35)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.15em');
  }

  // Y-axis with adaptive ticks, grid lines, and formatted values
  const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
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

  const colorScale = buildColorScale(encoding.color, data);
  const bandWidth = xScale.bandwidth();
  const maxHalfWidth = groups.length === 1
    ? Math.min(bandWidth * 0.45, dims.innerWidth * 0.2)
    : bandWidth * 0.45;

  // Sample points for KDE
  const yDomain = yScale.domain();
  const sampleCount = 80;
  const step = (yDomain[1] - yDomain[0]) / (sampleCount - 1);
  const samplePoints = Array.from({ length: sampleCount }, (_, i) => yDomain[0] + i * step);

  // Pre-compute group data for hover targets
  const groupData = groups.map((group) => {
    const groupValues = data
      .filter((d) => d[categoryField] === group)
      .map((d) => Number(d[valueField]))
      .filter((v) => !isNaN(v))
      .sort((a, b) => a - b);
    const stats = groupValues.length > 0 ? quartiles(groupValues) : { q1: 0, median: 0, q3: 0 };
    return { group, values: groupValues, stats };
  });

  // Full-column invisible hover targets (drawn first, behind everything)
  g.selectAll('.violin-hover-target')
    .data(groupData)
    .join('rect')
    .attr('class', 'violin-hover-target')
    .attr('x', (d: any) => xScale(d.group))
    .attr('y', 0)
    .attr('width', bandWidth)
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      g.selectAll(`.violin-shape-${groups.indexOf(d.group)}`)
        .attr('opacity', 0.9)
        .attr('stroke-width', 2);

      showTooltip(
        tooltip,
        `<strong>${d.group}</strong><br/>` +
          `Count: ${d.values.length}<br/>` +
          `Median: ${formatValue(d.stats.median)}<br/>` +
          `Q1: ${formatValue(d.stats.q1)}<br/>` +
          `Q3: ${formatValue(d.stats.q3)}`,
        event
      );
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function (_event: MouseEvent, d: any) {
      g.selectAll(`.violin-shape-${groups.indexOf(d.group)}`)
        .attr('opacity', 0.7)
        .attr('stroke-width', 1.5);
      hideTooltip(tooltip);
    });

  // Draw each violin
  groups.forEach((group, gi) => {
    const gd = groupData[gi];
    const groupValues = gd.values;

    if (groupValues.length === 0) return;

    const bandwidth = userBandwidth || silvermanBandwidth(groupValues);
    const densityPoints = kde(groupValues, samplePoints, bandwidth);

    // Max density for normalization
    const maxDensity = d3.max(densityPoints, (d: DensityPoint) => d.density) || 1;

    // Width scale: maps density to pixels (half-width of violin)
    const widthScale = (density: number) => (density / maxDensity) * maxHalfWidth;

    const xCenter = xScale(group)! + bandWidth / 2;
    const colorValue = encoding.color?.field ? data.find((d) => d[categoryField] === group)?.[encoding.color.field] : group;
    const fillColor = colorScale(colorValue);

    // Draw mirrored area
    const violinArea = d3
      .area()
      .x0((d: DensityPoint) => xCenter - widthScale(d.density))
      .x1((d: DensityPoint) => xCenter + widthScale(d.density))
      .y((d: DensityPoint) => yScale(d.value))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(densityPoints)
      .attr('class', `violin-shape violin-shape-${gi}`)
      .attr('d', violinArea)
      .attr('fill', fillColor)
      .attr('opacity', 0.7)
      .attr('stroke', fillColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.9)
      .attr('pointer-events', 'none');

    // Box plot overlay
    if (showBoxPlot && groupValues.length >= 4) {
      const stats = gd.stats;
      const iqr = stats.q3 - stats.q1;
      const whiskerLow = Math.max(groupValues[0], stats.q1 - 1.5 * iqr);
      const whiskerHigh = Math.min(groupValues[groupValues.length - 1], stats.q3 + 1.5 * iqr);
      const boxWidth = Math.min(bandWidth * 0.12, 12);

      // Whisker line
      g.append('line')
        .attr('x1', xCenter)
        .attr('x2', xCenter)
        .attr('y1', yScale(whiskerLow))
        .attr('y2', yScale(whiskerHigh))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');

      // Quartile box
      g.append('rect')
        .attr('x', xCenter - boxWidth / 2)
        .attr('y', yScale(stats.q3))
        .attr('width', boxWidth)
        .attr('height', yScale(stats.q1) - yScale(stats.q3))
        .attr('fill', 'rgba(15, 17, 23, 0.7)')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5)
        .attr('rx', 2)
        .attr('pointer-events', 'none');

      // Whisker caps
      const capWidth = boxWidth * 0.8;
      [whiskerLow, whiskerHigh].forEach((val) => {
        g.append('line')
          .attr('x1', xCenter - capWidth / 2)
          .attr('x2', xCenter + capWidth / 2)
          .attr('y1', yScale(val))
          .attr('y2', yScale(val))
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('pointer-events', 'none');
      });
    }

    // Quartile lines (thin dashed lines at Q1 and Q3)
    if (showQuartiles && groupValues.length >= 4) {
      const stats = gd.stats;
      [stats.q1, stats.q3].forEach((qVal) => {
        const qDensity = densityPoints.reduce(
          (closest, pt) =>
            Math.abs(pt.value - qVal) < Math.abs(closest.value - qVal) ? pt : closest,
          densityPoints[0]
        );
        const qHalfWidth = widthScale(qDensity.density);

        g.append('line')
          .attr('x1', xCenter - qHalfWidth)
          .attr('x2', xCenter + qHalfWidth)
          .attr('y1', yScale(qVal))
          .attr('y2', yScale(qVal))
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-opacity', 0.7)
          .attr('pointer-events', 'none');
      });
    }

    // Median line
    if (showMedian && groupValues.length >= 1) {
      const stats = gd.stats;
      const medianDensity = densityPoints.reduce(
        (closest, pt) =>
          Math.abs(pt.value - stats.median) < Math.abs(closest.value - stats.median) ? pt : closest,
        densityPoints[0]
      );
      const medianHalfWidth = widthScale(medianDensity.density);

      g.append('line')
        .attr('x1', xCenter - medianHalfWidth)
        .attr('x2', xCenter + medianHalfWidth)
        .attr('y1', yScale(stats.median))
        .attr('y2', yScale(stats.median))
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round')
        .attr('pointer-events', 'none');
    }
  });

  // Sort controls
  addSortControls(svg, container, spec, dims, renderViolin);
}
