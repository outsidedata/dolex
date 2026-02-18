/**
 * Donut/Pie chart D3 renderer.
 * Composition chart: circular part-to-whole with configurable inner radius.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  buildColorScale,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  createLegend,
  formatValue,
  contrastText,
  isAllZeros,
  DARK_BG,
  TEXT_COLOR,
  TEXT_MUTED,
  truncateTitle,
} from '../shared.js';

declare const d3: any;

export function renderDonut(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  const categoryField = config.categoryField || encoding.color?.field || encoding.x?.field;
  const valueField = config.valueField || encoding.y?.field;
  const innerRadiusRatio = config.innerRadius ?? 0.55;
  const showLabels = config.showLabels !== false;
  const showPercentages = config.showPercentages !== false;
  const centerLabel = config.centerLabel || '';
  const startAngle = (config.startAngle ?? 0) * (Math.PI / 180);

  const containerWidth = container.clientWidth || 800;
  const containerHeight = container.clientHeight || 500;
  const showLegend = containerHeight > 200 && containerWidth > 250;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = DARK_BG;
  container.style.borderRadius = '8px';
  container.style.overflow = 'hidden';

  const chartWrapper = document.createElement('div');
  chartWrapper.style.flex = '1';
  chartWrapper.style.minHeight = '0';
  chartWrapper.style.position = 'relative';
  container.appendChild(chartWrapper);

  const total = data.reduce((s: number, d: any) => s + (Math.abs(Number(d[valueField])) || 0), 0);

  // Compute min-visible threshold: 2% of max ensures extreme-range slices stay visible
  const rawValues = data.map((d: any) => Number(d[valueField]) || 0).filter((v: number) => v > 0);
  const maxVal = rawValues.length > 0 ? Math.max(...rawValues) : 0;
  const minVisible = maxVal * 0.02;
  const clampVal = (v: number) => (v > 0 && v < minVisible ? minVisible : v);

  const negativeCount = data.filter((d: any) => Number(d[valueField]) < 0).length;

  const items = data
    .filter((d: any) => Number(d[valueField]) > 0)
    .map((d: any) => ({
      category: String(d[categoryField]),
      value: clampVal(Number(d[valueField]) || 0),
      percentage: total > 0 ? ((Number(d[valueField]) || 0) / total) * 100 : 0,
    }));

  // Check if all values are zero
  if (isAllZeros(data, valueField)) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: ${TEXT_MUTED};
      font-size: 14px;
      font-family: Inter, system-ui, sans-serif;
    `;
    emptyDiv.textContent = 'All values are zero';
    chartWrapper.appendChild(emptyDiv);
    return;
  }

  const colorScale = buildColorScale(encoding.color, data);

  if (showLegend) {
    const legendDiv = createLegend(items.map(item => ({
      label: String(item.category),
      color: colorScale(item.category),
      extra: `${item.percentage.toFixed(1)}%`,
    })));
    container.appendChild(legendDiv);
  }

  const titleHeight = spec.title ? 32 : 0;
  const wrapperWidth = chartWrapper.clientWidth || containerWidth;
  const wrapperHeight = (chartWrapper.clientHeight || containerHeight) - (showLegend ? 40 : 0);

  const svg = d3
    .select(chartWrapper)
    .append('svg')
    .attr('width', wrapperWidth)
    .attr('height', wrapperHeight)
    .style('background', 'none');

  if (spec.title) {
    const titleEl = svg
      .append('text')
      .attr('x', wrapperWidth / 2)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(spec.title);
    truncateTitle(titleEl, spec.title, wrapperWidth - 20);
  }

  const tooltip = createTooltip(container);

  const availableHeight = wrapperHeight - titleHeight - 20;
  const availableWidth = wrapperWidth - 40;
  const radius = Math.max(40, Math.min(availableWidth, availableHeight) / 2);
  const innerRadius = radius * innerRadiusRatio;
  const cx = wrapperWidth / 2;
  const cy = titleHeight + 10 + availableHeight / 2;

  const pie = d3
    .pie()
    .value((d: any) => d.value)
    .sort(null)
    .startAngle(startAngle)
    .endAngle(startAngle + Math.PI * 2)
    .padAngle(0.01);

  const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius).cornerRadius(3);

  const arcHover = d3.arc().innerRadius(innerRadius).outerRadius(radius + 6).cornerRadius(3);

  const arcs = pie(items);

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  g.selectAll('.donut-slice')
    .data(arcs)
    .join('path')
    .attr('class', 'donut-slice')
    .attr('d', arc)
    .attr('fill', (d: any) => colorScale(d.data.category))
    .attr('stroke', DARK_BG)
    .attr('stroke-width', 1.5)
    .attr('pointer-events', 'none');

  g.selectAll('.donut-hover')
    .data(arcs)
    .join('path')
    .attr('class', 'donut-hover')
    .attr('d', arc)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      g.selectAll('.donut-slice').attr('opacity', (s: any) =>
        s.data.category === d.data.category ? 1 : 0.3
      );
      d3.select(g.selectAll('.donut-slice').nodes()[d.index]).attr('d', arcHover);

      showTooltip(
        tooltip,
        `<strong>${d.data.category}</strong><br/>${formatValue(d.data.value)}<br/>${d.data.percentage.toFixed(1)}%`,
        event
      );
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      g.selectAll('.donut-slice').attr('opacity', 1).attr('d', arc);
      hideTooltip(tooltip);
    });

  const labelMinRadius = 80;
  if (showLabels && items.length <= 8 && radius >= labelMinRadius) {
    const labelArc = d3
      .arc()
      .innerRadius(radius * 0.75)
      .outerRadius(radius * 0.75);

    g.selectAll('.donut-label')
      .data(arcs)
      .join('text')
      .attr('class', 'donut-label')
      .attr('transform', (d: any) => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d: any) => contrastText(colorScale(d.data.category)))
      .attr('font-size', () => {
        const size = Math.max(9, Math.min(12, radius / 12));
        return size + 'px';
      })
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-weight', '600')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const angle = d.endAngle - d.startAngle;
        if (angle < 0.25) return '';
        if (showPercentages) return d.data.percentage.toFixed(0) + '%';
        return formatValue(d.data.value);
      });
  }

  if (centerLabel && innerRadiusRatio > 0) {
    svg
      .append('text')
      .attr('x', cx)
      .attr('y', cy)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', Math.max(12, Math.min(20, innerRadius * 0.4)) + 'px')
      .attr('font-weight', '700')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(centerLabel);
  }

  if (negativeCount > 0) {
    svg.append('text')
      .attr('x', wrapperWidth / 2)
      .attr('y', wrapperHeight - 6)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '10px')
      .attr('font-style', 'italic')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(`${negativeCount} item${negativeCount > 1 ? 's' : ''} with negative values excluded`);
  }
}
