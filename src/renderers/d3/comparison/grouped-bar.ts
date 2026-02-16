/**
 * Grouped bar chart D3 renderer — side-by-side bars for multi-metric comparison.
 * Follows bar chart standards: adaptive layout, full-column hover, instant render, HTML legend.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  buildColorScale,
  createLegend,
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
  calculateLeftMargin,
  truncateLabel,
  shouldShowValueLabels,
  renderEmptyState,
  isAllZeros,
  DARK_BG,
  TEXT_MUTED,
} from '../shared.js';

declare const d3: any;

export function renderGroupedBar(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  let isHorizontal = config.orientation === 'horizontal';

  const categoryField = config.categoryField || encoding.x?.field;
  const seriesField = config.seriesField || encoding.color?.field;
  const valueField = config.valueField || encoding.y?.field;

  if (!categoryField || !valueField) return;

  let series: string[];
  let pivoted: Record<string, Record<string, number>>;

  if (seriesField) {
    series = [...new Set(data.map((d: any) => String(d[seriesField])))];
    pivoted = {};
    for (const d of data) {
      const cat = String(d[categoryField]);
      if (!pivoted[cat]) pivoted[cat] = {};
      pivoted[cat][String(d[seriesField])] = Number(d[valueField]) || 0;
    }
  } else {
    const numericFields = Object.keys(data[0] || {}).filter(
      (k) => k !== categoryField && typeof data[0][k] === 'number'
    );
    series = numericFields.length > 1 ? numericFields : [valueField];
    pivoted = {};
    for (const d of data) {
      const cat = String(d[categoryField]);
      pivoted[cat] = {};
      for (const s of series) {
        pivoted[cat][s] = Number(d[s]) || 0;
      }
    }
  }

  let categories = [...new Set(data.map((d: any) => String(d[categoryField])))];

  if (config.sortBy === 'value') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    categories.sort((a, b) => {
      const totalA = series.reduce((sum, s) => sum + (pivoted[a]?.[s] ?? 0), 0);
      const totalB = series.reduce((sum, s) => sum + (pivoted[b]?.[s] ?? 0), 0);
      return order * (totalA - totalB);
    });
  } else if (config.sortBy === 'category') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    categories.sort((a, b) => order * a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  }

  if (!isHorizontal && categories.length * series.length > 20) {
    isHorizontal = true;
  }

  let minVal = 0;
  let maxVal = 0;
  for (const cat of categories) {
    for (const s of series) {
      const v = pivoted[cat]?.[s as string] ?? 0;
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }

  // Check if all values are zero
  if (minVal === 0 && maxVal === 0) {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    container.appendChild(chartWrapper);
    const { svg, g, dims } = createSvg(chartWrapper, spec);
    svg.style('background', 'none');
    renderEmptyState(g, dims);
    return;
  }

  const containerWidth = container.clientWidth || 800;
  const containerHeight = container.clientHeight || 500;

  const showLegend = containerHeight > 250 && containerWidth > 350;

  const colorScale = buildColorScale(encoding.color, data, seriesField || valueField);

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = DARK_BG;
  container.style.borderRadius = '8px';
  container.style.overflow = 'hidden';

  const chartWrapper = document.createElement('div');
  chartWrapper.style.flex = '1';
  chartWrapper.style.minHeight = '0';
  container.appendChild(chartWrapper);

  let legendDiv: HTMLDivElement | null = null;
  if (showLegend) {
    legendDiv = createLegend(colorScale);
    container.appendChild(legendDiv);
  }

  const tooltip = createTooltip(container);

  if (isHorizontal) {
    const labels = categories;
    const leftMargin = calculateLeftMargin(labels);
    const { svg, g, dims } = createSvg(chartWrapper, spec, { left: leftMargin, bottom: 40, right: 30, top: 40 });
    svg.style('background', 'none').style('border-radius', '0');

    const yScale = d3.scaleBand().domain(categories).range([0, dims.innerHeight]).padding(0.2);

    // Clamp group height for single/few items
    const maxGroupHeight = Math.min(120, dims.innerHeight * 0.4);
    const groupHeight = Math.min(yScale.bandwidth(), maxGroupHeight);
    const groupYOffset = (yScale.bandwidth() - groupHeight) / 2;
    const yInner = d3.scaleBand().domain(series).range([0, groupHeight]).padding(0.05);

    const xScale = d3.scaleLinear().domain([Math.min(0, minVal), Math.max(0, maxVal)]).range([0, dims.innerWidth]).nice();

    const xTickCount = getAdaptiveTickCount(dims.innerWidth);
    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${dims.innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(xTickCount).tickSize(-dims.innerHeight).tickPadding(8)
        .tickFormat((d: number) => formatValue(d)));
    styleAxis(xAxis);

    const yAxis = g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).tickSize(0).tickPadding(10)
        .tickFormat((d: string) => truncateLabel(d, 25)));
    styleAxis(yAxis);

    g.selectAll('.group-hover-target')
      .data(categories)
      .join('rect')
      .attr('class', 'group-hover-target')
      .attr('y', (cat: string) => yScale(cat))
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', dims.innerWidth)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: MouseEvent, cat: string) {
        g.selectAll(`.bar[data-category="${CSS.escape(cat)}"]`).attr('opacity', 0.8);
        let html = `<strong>${cat}</strong>`;
        series.forEach((s) => {
          const val = pivoted[cat]?.[s] ?? 0;
          const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colorScale(s)};margin-right:4px"></span>`;
          html += `<br/>${swatch}${s}: ${formatValue(val)}`;
        });
        showTooltip(tooltip, html, event);
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', function () {
        g.selectAll('.bar').attr('opacity', 1);
        hideTooltip(tooltip);
      });

    for (const cat of categories) {
      for (const s of series) {
        const val = pivoted[cat]?.[s] ?? 0;
        g.append('rect')
          .attr('class', 'bar')
          .attr('data-category', cat)
          .attr('y', (yScale(cat) ?? 0) + groupYOffset + (yInner(s) ?? 0))
          .attr('x', val >= 0 ? xScale(0) : xScale(val))
          .attr('height', yInner.bandwidth())
          .attr('width', Math.max(2, Math.abs(xScale(val) - xScale(0))))
          .attr('fill', colorScale(s))
          .attr('rx', 2)
          .attr('pointer-events', 'none');
      }
    }

    addSortControls(svg, container, spec, dims, renderGroupedBar);
  } else {
    const estBarWidth = (containerWidth - 130) / categories.length;
    const willRotate = shouldRotateLabels(categories, estBarWidth);
    const bottomMargin = calculateBottomMargin(categories, willRotate);
    const { svg, g, dims } = createSvg(chartWrapper, spec, { bottom: bottomMargin, left: 70, right: 30, top: 40 });
    svg.style('background', 'none').style('border-radius', '0');

    const xScale = d3.scaleBand().domain(categories).range([0, dims.innerWidth]).padding(0.2);

    // Clamp group width for single/few items
    const maxGroupWidth = Math.min(120, dims.innerWidth * 0.4);
    const groupWidth = Math.min(xScale.bandwidth(), maxGroupWidth);
    const groupXOffset = (xScale.bandwidth() - groupWidth) / 2;
    const xInner = d3.scaleBand().domain(series).range([0, groupWidth]).padding(0.05);

    const yScale = d3.scaleLinear().domain([Math.min(0, minVal), Math.max(0, maxVal)]).range([dims.innerHeight, 0]).nice();

    const xAxis = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${dims.innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0).tickPadding(8)
        .tickFormat((d: string) => truncateLabel(d, 25)));
    styleAxis(xAxis);

    if (willRotate) {
      g.selectAll('.x-axis .tick text')
        .attr('transform', 'rotate(-35)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.15em');
    }

    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    const yAxis = g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).ticks(yTickCount).tickSize(-dims.innerWidth).tickPadding(8)
        .tickFormat((d: number) => formatValue(d)));
    styleAxis(yAxis);

    g.selectAll('.group-hover-target')
      .data(categories)
      .join('rect')
      .attr('class', 'group-hover-target')
      .attr('x', (cat: string) => xScale(cat))
      .attr('y', 0)
      .attr('width', xScale.bandwidth())
      .attr('height', dims.innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: MouseEvent, cat: string) {
        g.selectAll(`.bar[data-category="${CSS.escape(cat)}"]`).attr('opacity', 0.8);
        let html = `<strong>${cat}</strong>`;
        series.forEach((s) => {
          const val = pivoted[cat]?.[s] ?? 0;
          const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colorScale(s)};margin-right:4px"></span>`;
          html += `<br/>${swatch}${s}: ${formatValue(val)}`;
        });
        showTooltip(tooltip, html, event);
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', function () {
        g.selectAll('.bar').attr('opacity', 1);
        hideTooltip(tooltip);
      });

    for (const cat of categories) {
      for (const s of series) {
        const val = pivoted[cat]?.[s] ?? 0;
        const barHeight = Math.max(2, Math.abs(yScale(0) - yScale(val)));
        g.append('rect')
          .attr('class', 'bar')
          .attr('data-category', cat)
          .attr('x', (xScale(cat) ?? 0) + groupXOffset + (xInner(s) ?? 0))
          .attr('y', val >= 0 ? yScale(val) : yScale(0))
          .attr('width', xInner.bandwidth())
          .attr('height', barHeight)
          .attr('fill', colorScale(s))
          .attr('rx', 2)
          .attr('pointer-events', 'none');
      }
    }

    const showLabels = shouldShowValueLabels(config, xInner.bandwidth(), false);
    if (showLabels) {
      for (const cat of categories) {
        for (const s of series) {
          const val = pivoted[cat]?.[s] ?? 0;
          const barHeight = Math.abs(yScale(0) - yScale(val));
          const barX = (xScale(cat) ?? 0) + groupXOffset + (xInner(s) ?? 0) + xInner.bandwidth() / 2;
          const yPos = val >= 0 ? yScale(val) : yScale(0);
          const inside = barHeight >= 20;
          g.append('text')
            .attr('class', 'bar-label')
            .attr('x', barX)
            .attr('y', inside ? yPos + 14 : yPos - 6)
            .attr('text-anchor', 'middle')
            .attr('fill', inside ? '#ffffff' : TEXT_MUTED)
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text(formatValue(val));
        }
      }
    }

    addSortControls(svg, container, spec, dims, renderGroupedBar);
  }
}

