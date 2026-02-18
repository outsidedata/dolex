/**
 * Beeswarm chart D3 renderer.
 *
 * Horizontal dodge layout: one quantitative axis (x) with optional categorical
 * grouping (y bands). Dots are dodge-positioned to avoid overlap while showing
 * distribution shape (unlike strip-plot which uses random jitter).
 *
 * Modeled on the strip-plot renderer: Delaunay hover, flex legend with
 * interactive highlighting, adaptive dot radius, instant rendering.
 */

import type { VisualizationSpec } from '../../../types.js';
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
  calculateLeftMargin,
  truncateLabel,
  createLegend,
  DARK_BG,
  TEXT_MUTED,
} from '../shared.js';
import type { LegendCallbacks } from '../shared.js';
import { categorical } from '../../../theme/colors.js';

declare const d3: any;

// ─── DODGE ALGORITHM ─────────────────────────────────────────────────────────

/**
 * Simple dodge algorithm for beeswarm layout.
 * Returns an array of y-offsets from center for each point.
 */
function dodgeBeeswarm(xPositions: number[], spacing: number, maxOffset: number): number[] {
  const offsets: number[] = new Array(xPositions.length).fill(0);
  const placed: { x: number; y: number }[] = [];

  for (let i = 0; i < xPositions.length; i++) {
    const x = xPositions[i];
    let bestY = 0;
    let found = false;

    for (let dy = 0; dy <= maxOffset; dy += spacing * 0.9) {
      for (const sign of dy === 0 ? [1] : [1, -1]) {
        const candidateY = sign * dy;
        const overlaps = placed.some(
          (p) =>
            Math.sqrt((p.x - x) ** 2 + (p.y - candidateY) ** 2) < spacing
        );
        if (!overlaps) {
          bestY = candidateY;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    offsets[i] = bestY;
    placed.push({ x, y: bestY });
  }

  return offsets;
}

// ─── BEESWARM ────────────────────────────────────────────────────────────────

export function renderBeeswarm(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  if (!data || data.length === 0) {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:14px;font-family:Inter,system-ui,sans-serif;background:#0f1117;border-radius:8px;">No data for beeswarm</div>`;
    return;
  }

  const valueField = config.valueField || encoding.x?.field || Object.keys(data[0])[0];

  if (!valueField) {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:14px;font-family:Inter,system-ui,sans-serif;background:#0f1117;border-radius:8px;">Beeswarm requires a numeric value field</div>`;
    return;
  }

  const categoryField = config.categoryField || encoding.y?.field || null;
  const baseRadius = config.dotRadius ?? 4;
  const opacity = config.opacity ?? 0.7;

  const hasLegend = categoryField !== null && encoding.color?.field != null;

  // ── Container layout: flex column with chartWrapper + legend ──
  container.innerHTML = '';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.overflow = 'hidden';

  const chartWrapper = document.createElement('div');
  chartWrapper.style.cssText = 'flex: 1; min-height: 0;';
  container.appendChild(chartWrapper);

  // ── Adaptive left margin: hide Y labels when narrow ──
  const containerWidth = container.clientWidth || 800;
  const isSmall = containerWidth <= 400;
  let leftMargin = 12;
  if (categoryField && !isSmall) {
    const groups = [...new Set(data.map((d) => String(d[categoryField])))];
    leftMargin = calculateLeftMargin(groups.map(l => truncateLabel(l, 25)));
  }

  const { svg, g, dims } = createSvg(chartWrapper, spec, { left: leftMargin, right: 20 });
  const tooltip = createTooltip(container);

  // ── X scale (quantitative) ──
  const xValues = data.map((d) => Number(d[valueField]));
  const xExtent = d3.extent(xValues) as [number, number];
  const xPad = (xExtent[1] - xExtent[0]) * 0.05 || 1;

  const xScale = d3
    .scaleLinear()
    .domain([xExtent[0] - xPad, xExtent[1] + xPad])
    .range([0, dims.innerWidth])
    .nice();

  // ── X axis: direct creation + styleAxis ──
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

  // ── Color scale ──
  const colorScale = buildColorScale(encoding.color, data);

  if (categoryField) {
    renderGroupedBeeswarm(g, data, valueField, categoryField, encoding, config, xScale, colorScale, baseRadius, opacity, dims, tooltip, isSmall);
  } else {
    renderSingleBeeswarm(g, data, valueField, encoding, xScale, colorScale, baseRadius, opacity, dims, tooltip);
  }

  // ── HTML legend (below chart) with hover highlighting ──
  if (hasLegend) {
    const legendDiv = createLegend(colorScale, { shape: 'circle', callbacks: {
      onHover: (category: string) => {
        g.selectAll('.dot').each(function () {
          const match = d3.select(this).datum()?.[encoding.color?.field || categoryField!] === category;
          d3.select(this)
            .attr('opacity', match ? 1 : 0.08)
            .attr('r', match ? Number(d3.select(this).attr('data-r')) * 1.3 : Number(d3.select(this).attr('data-r')));
        });
      },
      onLeave: () => {
        g.selectAll('.dot').each(function () {
          d3.select(this)
            .attr('opacity', opacity)
            .attr('r', Number(d3.select(this).attr('data-r')));
        });
      },
    } });
    container.appendChild(legendDiv);
  }
}

// ─── GROUPED BEESWARM ────────────────────────────────────────────────────────

function renderGroupedBeeswarm(
  g: any,
  data: Record<string, any>[],
  valueField: string,
  categoryField: string,
  encoding: VisualizationSpec['encoding'],
  config: VisualizationSpec['config'],
  xScale: any,
  colorScale: any,
  baseRadius: number,
  opacity: number,
  dims: any,
  tooltip: HTMLDivElement,
  isSmall: boolean
): void {
  const groups = [...new Set(data.map((d) => d[categoryField]))];
  const yScale = d3.scaleBand().domain(groups).range([0, dims.innerHeight]).padding(0.15);
  const bandwidth = yScale.bandwidth();

  // ── Y axis (skip labels when small, color-match to dots) ──
  if (!isSmall) {
    const yAxis = g
      .append('g')
      .attr('class', 'y-axis')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((d: string) => truncateLabel(d, 25))
      );
    styleAxis(yAxis);

    const colorField = encoding.color?.field || categoryField;
    yAxis.selectAll('.tick text').each(function (label: string) {
      d3.select(this).attr('fill', colorScale(label));
    });
  }

  // Band separator lines
  groups.forEach((group) => {
    const bandTop = yScale(group)!;
    g.append('line')
      .attr('x1', 0)
      .attr('y1', bandTop)
      .attr('x2', dims.innerWidth)
      .attr('y2', bandTop)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '2,2');
  });

  // ── Adaptive dot radius ──
  const totalPoints = data.length;
  const plotArea = (dims.innerWidth * bandwidth * groups.length) / 10000;
  const density = totalPoints / Math.max(plotArea, 1);
  let dotRadius = baseRadius;
  if (density > 8) dotRadius = Math.max(2, baseRadius - 2);
  else if (density > 4) dotRadius = Math.max(2.5, baseRadius - 1);
  dotRadius = Math.min(dotRadius, bandwidth / 4);

  // ── Pre-compute positions using dodge algorithm ──
  const pointPositions: { d: Record<string, any>; i: number; cx: number; cy: number; r: number }[] = [];

  groups.forEach((group) => {
    const groupData = data.filter((d) => d[categoryField] === group);
    const bandMid = yScale(group)! + bandwidth / 2;

    groupData.sort((a, b) => Number(a[valueField]) - Number(b[valueField]));

    const xPositions = groupData.map((d) => xScale(Number(d[valueField])));
    const offsets = dodgeBeeswarm(xPositions, dotRadius * 2.2, bandwidth / 2 - dotRadius);

    groupData.forEach((d, j) => {
      const globalIdx = data.indexOf(d);
      pointPositions.push({
        d,
        i: pointPositions.length,
        cx: xPositions[j],
        cy: bandMid + offsets[j],
        r: dotRadius,
      });
    });
  });

  // ── Delaunay hover layer ──
  const delaunay = d3.Delaunay.from(
    pointPositions,
    (p: any) => p.cx,
    (p: any) => p.cy
  );

  let activeIdx = -1;

  g.append('rect')
    .attr('class', 'voronoi-overlay')
    .attr('width', dims.innerWidth)
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair')
    .on('mousemove', function (event: MouseEvent) {
      const [mx, my] = d3.pointer(event, g.node());
      const idx = delaunay.find(mx, my);
      if (idx === activeIdx) {
        positionTooltip(tooltip, event);
        return;
      }

      if (activeIdx >= 0) {
        const prev = pointPositions[activeIdx];
        g.selectAll('.dot')
          .filter((_: any, j: number) => j === prev.i)
          .attr('r', prev.r)
          .attr('opacity', opacity);
      }

      activeIdx = idx;
      const p = pointPositions[idx];

      g.selectAll('.dot')
        .filter((_: any, j: number) => j === p.i)
        .attr('r', p.r * 1.6)
        .attr('opacity', 1);

      let html = `<strong>${p.d[categoryField]}</strong>`;
      html += `<br/>${encoding.x?.title || valueField}: ${formatValue(Number(p.d[valueField]))}`;
      showTooltip(tooltip, html, event);
    })
    .on('mouseleave', function () {
      if (activeIdx >= 0) {
        const prev = pointPositions[activeIdx];
        g.selectAll('.dot')
          .filter((_: any, j: number) => j === prev.i)
          .attr('r', prev.r)
          .attr('opacity', opacity);
        activeIdx = -1;
      }
      hideTooltip(tooltip);
    });

  // ── Visible dots (pointer-events: none, instant) ──
  g.selectAll('.dot')
    .data(pointPositions)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', (p: any) => p.cx)
    .attr('cy', (p: any) => p.cy)
    .attr('r', (p: any) => p.r)
    .attr('data-r', (p: any) => p.r)
    .attr('fill', (p: any) => colorScale(p.d[encoding.color?.field || categoryField]))
    .attr('opacity', opacity)
    .attr('stroke', DARK_BG)
    .attr('stroke-width', 0.8)
    .attr('pointer-events', 'none');

  // ── Median lines ──
  if (config.showMedianLine) {
    groups.forEach((group) => {
      const groupValues = data
        .filter((d) => d[categoryField] === group)
        .map((d) => Number(d[valueField]))
        .sort((a, b) => a - b);
      const mid = Math.floor(groupValues.length / 2);
      const median = groupValues.length % 2 === 0
        ? (groupValues[mid - 1] + groupValues[mid]) / 2
        : groupValues[mid];
      const medianX = xScale(median);

      g.append('line')
        .attr('x1', medianX)
        .attr('y1', yScale(group)!)
        .attr('x2', medianX)
        .attr('y2', yScale(group)! + bandwidth)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.6)
        .attr('pointer-events', 'none');
    });
  }
}

// ─── SINGLE BEESWARM (NO GROUPS) ────────────────────────────────────────────

function renderSingleBeeswarm(
  g: any,
  data: Record<string, any>[],
  valueField: string,
  encoding: VisualizationSpec['encoding'],
  xScale: any,
  colorScale: any,
  baseRadius: number,
  opacity: number,
  dims: any,
  tooltip: HTMLDivElement
): void {
  // ── Adaptive dot radius ──
  const density = data.length / ((dims.innerWidth * dims.innerHeight) / 10000);
  let dotRadius = baseRadius;
  if (density > 5) dotRadius = Math.max(2, baseRadius - 2);
  else if (density > 2) dotRadius = Math.max(3, baseRadius - 1);

  const sortedData = [...data].sort(
    (a, b) => Number(a[valueField]) - Number(b[valueField])
  );

  const xPositions = sortedData.map((d) => xScale(Number(d[valueField])));
  const offsets = dodgeBeeswarm(xPositions, dotRadius * 2.2, dims.innerHeight / 2 - dotRadius);

  const midY = dims.innerHeight / 2;

  // ── Pre-compute positions ──
  const pointPositions = sortedData.map((d, i) => ({
    d,
    i,
    cx: xPositions[i],
    cy: midY + offsets[i],
    r: dotRadius,
  }));

  // ── Delaunay hover layer ──
  const delaunay = d3.Delaunay.from(
    pointPositions,
    (p: any) => p.cx,
    (p: any) => p.cy
  );

  let activeIdx = -1;

  g.append('rect')
    .attr('class', 'voronoi-overlay')
    .attr('width', dims.innerWidth)
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'crosshair')
    .on('mousemove', function (event: MouseEvent) {
      const [mx, my] = d3.pointer(event, g.node());
      const idx = delaunay.find(mx, my);
      if (idx === activeIdx) {
        positionTooltip(tooltip, event);
        return;
      }

      if (activeIdx >= 0) {
        const prev = pointPositions[activeIdx];
        g.selectAll('.dot')
          .filter((_: any, j: number) => j === prev.i)
          .attr('r', prev.r)
          .attr('opacity', opacity);
      }

      activeIdx = idx;
      const p = pointPositions[idx];

      g.selectAll('.dot')
        .filter((_: any, j: number) => j === p.i)
        .attr('r', p.r * 1.6)
        .attr('opacity', 1);

      const html = `<strong>${encoding.x?.title || valueField}</strong>: ${formatValue(Number(p.d[valueField]))}`;
      showTooltip(tooltip, html, event);
    })
    .on('mouseleave', function () {
      if (activeIdx >= 0) {
        const prev = pointPositions[activeIdx];
        g.selectAll('.dot')
          .filter((_: any, j: number) => j === prev.i)
          .attr('r', prev.r)
          .attr('opacity', opacity);
        activeIdx = -1;
      }
      hideTooltip(tooltip);
    });

  // ── Visible dots (pointer-events: none, instant) ──
  const colorField = encoding.color?.field;
  g.selectAll('.dot')
    .data(pointPositions)
    .join('circle')
    .attr('class', 'dot')
    .attr('cx', (p: any) => p.cx)
    .attr('cy', (p: any) => p.cy)
    .attr('r', (p: any) => p.r)
    .attr('data-r', (p: any) => p.r)
    .attr('fill', (p: any) => (colorField ? colorScale(p.d[colorField]) : categorical[0]))
    .attr('opacity', opacity)
    .attr('stroke', DARK_BG)
    .attr('stroke-width', 0.8)
    .attr('pointer-events', 'none');
}
