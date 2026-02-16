/**
 * Histogram D3 renderer — bins continuous values and shows frequency.
 *
 * Supports two data modes:
 *   1. Raw data: rows with a numeric field → d3.bin() computes bins
 *   2. Pre-binned: rows with binStart/binEnd/count fields
 *
 * Optional stat overlays: mean line, median line.
 */

import type { VisualizationSpec, ColorEncoding } from '../../../types.js';
import {
  createSvg,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  styleAxis,
  getAdaptiveTickCount,
  shouldShowValueLabels,
  renderEmptyState,
  isAllZeros,
  DEFAULT_PALETTE,
  TEXT_MUTED,
} from '../shared.js';
import { sequential } from '../../../theme/colors.js';

declare const d3: any;

// ─── HISTOGRAM-SPECIFIC COLOR ────────────────────────────────────────────────
//
// Histograms aggregate raw data into bins, so the generic buildColorScale
// (which maps row-level field values) doesn't apply. Instead we build
// a color function that takes a bin's range [x0, x1) and returns a fill.

/** Resolve a palette name to its color array. */
function getSequentialPalette(name: string): string[] | null {
  const palettes: Record<string, string[]> = {
    blue: [...sequential.blue],
    green: [...sequential.green],
    purple: [...sequential.purple],
    warm: [...sequential.warm],
  };
  return palettes[name] || null;
}

/**
 * Build a fill function for histogram bins.
 *
 * Returns (x0, x1) => color string.
 *   - Sequential palette: gradient from x-domain min→max
 *   - Highlight: bins containing a target value get the highlight color
 *   - Default: single color from categorical palette
 */
function buildBinColorFn(
  colorEncoding: ColorEncoding | undefined,
  xDomain: [number, number]
): (x0: number, x1: number) => string {
  if (!colorEncoding) {
    return () => DEFAULT_PALETTE[0];
  }

  // ── HIGHLIGHT MODE ──
  if (colorEncoding.highlight) {
    const targetValues = colorEncoding.highlight.values.map(Number);
    const highlightColors = Array.isArray(colorEncoding.highlight.color)
      ? colorEncoding.highlight.color
      : colorEncoding.highlight.color
        ? [colorEncoding.highlight.color]
        : [DEFAULT_PALETTE[0]];
    const mutedColor = colorEncoding.highlight.mutedColor || '#6b7280';
    const mutedOpacity = colorEncoding.highlight.mutedOpacity ?? 1.0;

    const mutedFill = mutedOpacity < 1.0
      ? (() => {
          const hex = mutedColor.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          return `rgba(${r}, ${g}, ${b}, ${mutedOpacity})`;
        })()
      : mutedColor;

    return (x0: number, x1: number) => {
      // Check if any target value falls within this bin
      for (let i = 0; i < targetValues.length; i++) {
        const v = targetValues[i];
        if (v >= x0 && v < x1) {
          return highlightColors[i % highlightColors.length];
        }
      }
      return mutedFill;
    };
  }

  // ── SEQUENTIAL PALETTE ──
  if (colorEncoding.palette) {
    const palette = getSequentialPalette(colorEncoding.palette);
    if (palette) {
      // Build a continuous scale from domain extent to palette endpoints
      const scale = d3
        .scaleLinear()
        .domain([xDomain[0], xDomain[1]])
        .range([palette[0], palette[palette.length - 1]])
        .interpolate(d3.interpolateRgb)
        .clamp(true);

      return (x0: number, x1: number) => scale((x0 + x1) / 2);
    }
  }

  // ── DEFAULT ──
  return () => DEFAULT_PALETTE[0];
}

// ─── MAIN ENTRY ──────────────────────────────────────────────────────────────

export function renderHistogram(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const xField = encoding.x?.field || 'binMid';

  const hasBins = data[0]?.binStart !== undefined;

  if (hasBins) {
    renderPreBinnedHistogram(container, spec);
  } else {
    renderRawHistogram(container, spec, xField);
  }
}

// ─── PRE-BINNED ──────────────────────────────────────────────────────────────

function renderPreBinnedHistogram(
  container: HTMLElement,
  spec: VisualizationSpec
): void {
  const { data, encoding, config } = spec;

  const { svg, g, dims } = createSvg(container, spec, { right: 30 });
  const tooltip = createTooltip(container);

  const xMin = d3.min(data, (d: any) => d.binStart) as number;
  const xMax = d3.max(data, (d: any) => d.binEnd) as number;

  const xScale = d3
    .scaleLinear()
    .domain([xMin, xMax])
    .range([0, dims.innerWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d: any) => d.count)])
    .range([dims.innerHeight, 0])
    .nice();

  // Color — histogram-specific, operates on bin ranges
  const binColor = buildBinColorFn(encoding.color, [xMin, xMax]);

  // ── X-axis (quantitative) ──
  const xTickCount = getAdaptiveTickCount(dims.innerWidth);
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

  // ── Y-axis ──
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

  // ── Hover targets (full-height invisible rects per bin) ──
  const binWidth = xScale(data[0].binEnd) - xScale(data[0].binStart);

  g.selectAll('.bar-hover-target')
    .data(data)
    .join('rect')
    .attr('class', 'bar-hover-target')
    .attr('x', (d: any) => xScale(d.binStart))
    .attr('y', 0)
    .attr('width', binWidth)
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      g.selectAll('.bar')
        .filter((bd: any) => bd.binStart === d.binStart)
        .attr('opacity', 0.8);
      showTooltip(
        tooltip,
        `<strong>${d.binLabel || formatValue(d.binStart) + ' – ' + formatValue(d.binEnd)}</strong><br/>Count: ${formatValue(d.count)}`,
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

  // ── Bars ──
  g.selectAll('.bar')
    .data(data)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d: any) => xScale(d.binStart) + 1)
    .attr('y', (d: any) => yScale(d.count))
    .attr('width', Math.max(binWidth - 2, 1))
    .attr('height', (d: any) => dims.innerHeight - yScale(d.count))
    .attr('fill', (d: any) => binColor(d.binStart, d.binEnd))
    .attr('rx', 1)
    .attr('pointer-events', 'none');

  // ── Value labels ──
  const showLabels = shouldShowValueLabels(config, binWidth, false);
  if (showLabels) {
    g.selectAll('.bar-label')
      .data(data)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (d: any) => xScale(d.binStart) + binWidth / 2)
      .attr('y', (d: any) => {
        const barHeight = dims.innerHeight - yScale(d.count);
        const yPos = yScale(d.count);
        return barHeight < 20 ? yPos - 6 : yPos + 14;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any) => {
        const barHeight = dims.innerHeight - yScale(d.count);
        return barHeight < 20 ? TEXT_MUTED : '#ffffff';
      })
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .text((d: any) => formatValue(d.count));
  }

  // ── Stat lines ──
  drawStatLines(g, xScale, dims.innerHeight, config);
}

// ─── RAW DATA ────────────────────────────────────────────────────────────────

function renderRawHistogram(
  container: HTMLElement,
  spec: VisualizationSpec,
  xField: string
): void {
  const { data, encoding, config } = spec;

  const values = data.map((d) => Number(d[xField])).filter((v) => !isNaN(v));
  const binCount = config.binCount || Math.ceil(Math.log2(values.length) + 1);

  const { svg, g, dims } = createSvg(container, spec, { right: 30 });
  const tooltip = createTooltip(container);

  if (values.every(v => v === 0)) {
    renderEmptyState(g, dims);
    return;
  }

  // Scales
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(values) as [number, number])
    .range([0, dims.innerWidth])
    .nice();

  const histogram = d3.bin().domain(xScale.domain()).thresholds(binCount);
  const bins = histogram(values);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (b: any) => b.length)])
    .range([dims.innerHeight, 0])
    .nice();

  // Color — histogram-specific, operates on bin ranges
  const xDom = xScale.domain() as [number, number];
  const binColor = buildBinColorFn(encoding.color, xDom);

  // ── X-axis (quantitative) ──
  const xTickCount = getAdaptiveTickCount(dims.innerWidth);
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

  // ── Y-axis ──
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

  // ── Hover targets (full-height per bin) ──
  g.selectAll('.bar-hover-target')
    .data(bins)
    .join('rect')
    .attr('class', 'bar-hover-target')
    .attr('x', (d: any) => xScale(d.x0))
    .attr('y', 0)
    .attr('width', (d: any) => Math.max(xScale(d.x1) - xScale(d.x0), 1))
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      g.selectAll('.bar')
        .filter((bd: any) => bd.x0 === d.x0)
        .attr('opacity', 0.8);
      showTooltip(
        tooltip,
        `<strong>${formatValue(d.x0)} – ${formatValue(d.x1)}</strong><br/>Count: ${formatValue(d.length)}`,
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

  // ── Bars ──
  g.selectAll('.bar')
    .data(bins)
    .join('rect')
    .attr('class', 'bar')
    .attr('x', (d: any) => xScale(d.x0) + 1)
    .attr('y', (d: any) => yScale(d.length))
    .attr('width', (d: any) => Math.max(xScale(d.x1) - xScale(d.x0) - 2, 1))
    .attr('height', (d: any) => dims.innerHeight - yScale(d.length))
    .attr('fill', (d: any) => binColor(d.x0, d.x1))
    .attr('rx', 1)
    .attr('pointer-events', 'none');

  // ── Value labels ──
  const avgBinWidth = bins.length > 0
    ? Math.max(...bins.map((b: any) => xScale(b.x1) - xScale(b.x0)))
    : 0;
  const showLabels = shouldShowValueLabels(config, avgBinWidth, false);
  if (showLabels) {
    g.selectAll('.bar-label')
      .data(bins)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (d: any) => (xScale(d.x0) + xScale(d.x1)) / 2)
      .attr('y', (d: any) => {
        const barHeight = dims.innerHeight - yScale(d.length);
        const yPos = yScale(d.length);
        return barHeight < 20 ? yPos - 6 : yPos + 14;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any) => {
        const barHeight = dims.innerHeight - yScale(d.length);
        return barHeight < 20 ? TEXT_MUTED : '#ffffff';
      })
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .text((d: any) => d.length > 0 ? formatValue(d.length) : '');
  }

  // ── Stat lines ──
  const mean = config.mean ?? values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median = config.median ?? sorted[Math.floor(sorted.length / 2)];

  drawStatLines(g, xScale, dims.innerHeight, {
    ...config,
    mean,
    median,
  });
}

// ─── STAT LINES ──────────────────────────────────────────────────────────────

function drawStatLines(
  g: any,
  xScale: any,
  innerHeight: number,
  config: VisualizationSpec['config']
): void {
  if (config.showMean && config.mean != null) {
    drawStatLine(g, xScale(config.mean), innerHeight, '#f59e0b', '6,3', `Mean: ${formatValue(config.mean)}`, 14);
  }
  if (config.showMedian && config.median != null) {
    drawStatLine(g, xScale(config.median), innerHeight, '#10b981', '3,3', `Median: ${formatValue(config.median)}`, 30);
  }
}

function drawStatLine(
  g: any,
  x: number,
  height: number,
  color: string,
  dashArray: string,
  label: string,
  labelY: number
): void {
  g.append('line')
    .attr('x1', x)
    .attr('y1', 0)
    .attr('x2', x)
    .attr('y2', height)
    .attr('stroke', color)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', dashArray)
    .attr('pointer-events', 'none');

  g.append('text')
    .attr('x', x + 6)
    .attr('y', labelY)
    .attr('fill', color)
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .attr('font-family', 'Inter, system-ui, sans-serif')
    .attr('pointer-events', 'none')
    .text(label);
}
