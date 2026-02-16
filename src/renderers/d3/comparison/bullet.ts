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
  truncateLabel,
  TEXT_COLOR,
  TEXT_MUTED,
} from '../shared.js';

declare const d3: any;

const RANGE_COLORS = ['#1a1f2e', '#252b3d', '#313850'];

export function renderBullet(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const metricField = config.metricField;
  const actualField = config.actualField;
  const targetField = config.targetField;
  const rangeFields: string[] | undefined = config.rangeFields;

  if (!data || data.length === 0) return;

  let sortedData = [...data];
  if (config.sortBy === 'value') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    sortedData.sort((a, b) => order * (Number(a[actualField]) - Number(b[actualField])));
  } else if (config.sortBy === 'category') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    sortedData.sort((a, b) =>
      order * String(a[metricField]).localeCompare(String(b[metricField]), undefined, { sensitivity: 'base', numeric: true })
    );
  }

  const labels = sortedData.map((d) => String(d[metricField] ?? ''));
  const leftMargin = calculateLeftMargin(labels);

  const containerHeight = container.clientHeight || 500;
  const topMargin = 40;
  const bottomMargin = 40;
  const availableHeight = containerHeight - topMargin - bottomMargin;
  const maxPerRow = Math.floor(availableHeight / sortedData.length);
  const bulletHeight = Math.max(16, Math.min(48, maxPerRow - 8));
  const bulletGap = Math.max(4, Math.min(16, maxPerRow - bulletHeight));
  const totalBulletHeight = bulletHeight + bulletGap;
  const usedHeight = sortedData.length * totalBulletHeight;

  const { svg, g, dims } = createSvg(container, spec, {
    left: leftMargin,
    right: 40,
    bottom: bottomMargin,
    top: topMargin,
  });

  const tooltip = createTooltip(container);
  const colorEncoding = encoding.color || { field: metricField, type: 'nominal' as const };
  const colorScale = buildColorScale(colorEncoding as any, data);

  const metrics = sortedData.map((d, i) => {
    const actual = Number(d[actualField]) || 0;
    const target = targetField && d[targetField] != null ? Number(d[targetField]) : null;
    const label = String(d[metricField] ?? `Metric ${i + 1}`);

    let ranges: number[];
    if (rangeFields && rangeFields.length > 0) {
      ranges = rangeFields
        .map((f) => Number(d[f]))
        .filter((v) => !isNaN(v))
        .sort((a, b) => a - b);
    } else {
      const maxRef = Math.max(Math.abs(actual), Math.abs(target ?? 0));
      const ceiling = maxRef * 1.2 || 100;
      const sign = actual < 0 && (target === null || target <= 0) ? -1 : 1;
      ranges = [sign * ceiling * 0.33, sign * ceiling * 0.66, sign * ceiling];
    }

    const allVals = [...ranges, actual, ...(target !== null ? [target] : [])];
    const maxRange = Math.max(...allVals);
    const minRange = Math.min(0, ...allVals);
    return { label, actual, target, ranges, maxRange, minRange, index: i, datum: d };
  });

  const isSmall = bulletHeight < 28;

  metrics.forEach((metric) => {
    const yOffset = metric.index * totalBulletHeight;
    const bulletG = g.append('g').attr('transform', `translate(0,${yOffset})`);

    const domainMin = metric.minRange < 0 ? metric.minRange * 1.05 : 0;
    const domainMax = metric.maxRange > 0 ? metric.maxRange * 1.05 : 1;
    const xScale = d3
      .scaleLinear()
      .domain([domainMin, domainMax])
      .range([0, dims.innerWidth])
      .nice();

    const ticks = xScale.ticks(getAdaptiveTickCount(dims.innerWidth, 80));
    ticks.forEach((tick: number) => {
      const tx = xScale(tick);
      bulletG.append('line')
        .attr('x1', tx).attr('y1', 0)
        .attr('x2', tx).attr('y2', bulletHeight)
        .attr('stroke', '#ffffff')
        .attr('stroke-opacity', 0.06)
        .attr('pointer-events', 'none');
      bulletG.append('text')
        .attr('x', tx)
        .attr('y', bulletHeight + 10)
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', isSmall ? '7px' : '8px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(formatValue(tick));
    });

    const barCenter = bulletHeight / 2;

    bulletG
      .append('rect')
      .attr('class', 'hover-target')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', dims.innerWidth)
      .attr('height', bulletHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: MouseEvent) {
        bulletG.select('.actual-bar').attr('opacity', 0.85);

        let html = `<strong>${metric.label}</strong>`;
        html += `<br/>Actual: ${formatValue(metric.actual)}`;

        if (metric.target !== null) {
          html += `<br/>Target: ${formatValue(metric.target)}`;
          const pct = ((metric.actual / metric.target) * 100).toFixed(1);
          html += `<br/>Achievement: ${pct}%`;
        }

        if (config.rangeLabels && metric.ranges.length > 0) {
          const rangeLabels = config.rangeLabels as string[];
          metric.ranges.forEach((r, ri) => {
            if (rangeLabels[ri]) {
              html += `<br/><span style="color:${TEXT_MUTED}">${rangeLabels[ri]}: ${formatValue(r)}</span>`;
            }
          });
        }

        showTooltip(tooltip, html, event);
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', function () {
        bulletG.select('.actual-bar').attr('opacity', 1);
        hideTooltip(tooltip);
      });

    const zeroX = xScale(0);
    const sortedRanges = [...metric.ranges].sort((a, b) => b - a);
    sortedRanges.forEach((rangeVal, ri) => {
      const colorIndex = Math.min(ri, RANGE_COLORS.length - 1);
      const rx = xScale(rangeVal);
      const bandX = Math.min(zeroX, rx);
      const bandW = Math.abs(rx - zeroX);
      bulletG
        .append('rect')
        .attr('class', 'range-band')
        .attr('x', bandX)
        .attr('y', 0)
        .attr('width', Math.max(0, bandW))
        .attr('height', bulletHeight)
        .attr('fill', RANGE_COLORS[RANGE_COLORS.length - 1 - colorIndex])
        .attr('rx', 2)
        .attr('pointer-events', 'none');
    });

    const actualBarHeight = Math.max(6, Math.min(14, bulletHeight * 0.3));
    const accentColor = colorScale(metric.datum[metricField]);
    const actualX = xScale(metric.actual);
    const barX = Math.min(zeroX, actualX);
    const barW = Math.max(2, Math.abs(actualX - zeroX));
    bulletG
      .append('rect')
      .attr('class', 'actual-bar')
      .attr('x', barX)
      .attr('y', barCenter - actualBarHeight / 2)
      .attr('width', barW)
      .attr('height', actualBarHeight)
      .attr('fill', accentColor)
      .attr('rx', 2)
      .attr('pointer-events', 'none');

    if (metric.target !== null) {
      const markerHeight = Math.max(10, Math.min(26, bulletHeight * 0.55));
      bulletG
        .append('line')
        .attr('class', 'target-marker')
        .attr('x1', xScale(metric.target))
        .attr('y1', barCenter - markerHeight / 2)
        .attr('x2', xScale(metric.target))
        .attr('y2', barCenter + markerHeight / 2)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2.5)
        .attr('pointer-events', 'none');
    }

    bulletG
      .append('text')
      .attr('class', 'metric-label')
      .attr('x', -10)
      .attr('y', barCenter + 1)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', isSmall ? '10px' : '12px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .text(truncateLabel(metric.label, 22));

    if (!isSmall && config.showLabels !== false) {
      const labelX = metric.actual >= 0 ? xScale(metric.actual) + 8 : xScale(metric.actual) - 8;
      const labelAnchor = metric.actual >= 0 ? 'start' : 'end';
      if (metric.actual >= 0 ? labelX < dims.innerWidth - 40 : labelX > 40) {
        bulletG
          .append('text')
          .attr('class', 'value-label')
          .attr('x', labelX)
          .attr('y', barCenter + 1)
          .attr('text-anchor', labelAnchor)
          .attr('dominant-baseline', 'middle')
          .attr('fill', TEXT_MUTED)
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('pointer-events', 'none')
          .text(formatValue(metric.actual));
      }
    }
  });

  addSortControls(svg, container, spec, dims, renderBullet);
}
