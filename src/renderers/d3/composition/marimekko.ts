import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  buildColorScale,
  addSortControls,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  createLegend,
  formatValue,
  truncateLabel,
  contrastText,
  renderEmptyState,
  isAllZeros,
  DARK_BG,
  TEXT_MUTED,
  AXIS_COLOR,
} from '../shared.js';

declare const d3: any;

interface ColumnData {
  primaryKey: string;
  total: number;
  x: number;
  width: number;
  segments: SegmentData[];
}

interface SegmentData {
  primaryKey: string;
  secondaryKey: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pctOfColumn: number;
  pctOfTotal: number;
}

export function renderMarimekko(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;

  const categoryField = config.categoryField || encoding.x?.field;
  const seriesField = config.seriesField || encoding.color?.field;
  const valueField = config.valueField || encoding.y?.field;
  const showLabels = config.showLabels !== false;
  const showPercentages = config.showPercentages !== false;

  const containerWidth = container.clientWidth || 800;
  const containerHeight = container.clientHeight || 500;
  const showLegend = containerHeight > 200 && containerWidth > 250;

  const colorScale = buildColorScale(encoding.color, data);
  const secondaryKeys = [...new Set(data.map((d: any) => String(d[seriesField])))];

  let primaryKeys = [...new Set(data.map((d: any) => String(d[categoryField])))];

  const columnTotals: Record<string, number> = {};
  primaryKeys.forEach((pk) => {
    columnTotals[pk] = 0;
    data.forEach((d: any) => {
      if (String(d[categoryField]) === pk) {
        columnTotals[pk] += Math.abs(Number(d[valueField])) || 0;
      }
    });
  });

  if (config.sortBy === 'value') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    primaryKeys.sort((a, b) => order * (columnTotals[a] - columnTotals[b]));
  } else if (config.sortBy === 'category') {
    const order = config.sortOrder === 'ascending' ? 1 : -1;
    primaryKeys.sort((a, b) =>
      order * a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
    );
  }

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

  const { svg, g, dims } = createSvg(chartWrapper, spec, {
    bottom: 50,
    left: 20,
    right: 30,
    top: 40,
  });

  svg.style('background', 'none').style('border-radius', '0');

  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (isAllZeros(data, valueField)) {
    renderEmptyState(g, dims);
    return;
  }

  const grandTotal = data.reduce((s: number, d: any) => s + (Math.abs(Number(d[valueField])) || 0), 0);

  if (grandTotal === 0 || primaryKeys.length === 0 || secondaryKeys.length === 0) {
    g.append('text')
      .attr('x', dims.innerWidth / 2)
      .attr('y', dims.innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '13px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('No data to display');
    return;
  }

  const gap = Math.max(1, Math.min(3, dims.innerWidth / primaryKeys.length * 0.03));
  const totalGaps = gap * (primaryKeys.length - 1);
  const availableWidth = dims.innerWidth - totalGaps;

  const columns: ColumnData[] = [];
  let currentX = 0;

  primaryKeys.forEach((pk, i) => {
    const colTotal = columnTotals[pk];
    const colWidth = grandTotal > 0 ? (colTotal / grandTotal) * availableWidth : availableWidth / primaryKeys.length;

    const segments: SegmentData[] = [];
    let currentY = 0;

    secondaryKeys.forEach((sk) => {
      const row = data.find((d: any) => String(d[categoryField]) === pk && String(d[seriesField]) === sk);
      const val = row ? Math.abs(Number(row[valueField])) || 0 : 0;

      if (val === 0) {
        segments.push({
          primaryKey: pk, secondaryKey: sk, value: 0,
          x: currentX, y: currentY, width: colWidth, height: 0,
          pctOfColumn: 0, pctOfTotal: 0,
        });
        return;
      }

      const segHeight = colTotal > 0 ? (val / colTotal) * dims.innerHeight : 0;

      segments.push({
        primaryKey: pk, secondaryKey: sk, value: val,
        x: currentX, y: currentY, width: colWidth, height: segHeight,
        pctOfColumn: colTotal > 0 ? (val / colTotal) * 100 : 0,
        pctOfTotal: grandTotal > 0 ? (val / grandTotal) * 100 : 0,
      });

      currentY += segHeight;
    });

    columns.push({ primaryKey: pk, total: colTotal, x: currentX, width: colWidth, segments });
    currentX += colWidth + (i < primaryKeys.length - 1 ? gap : 0);
  });

  const allSegments = columns.flatMap((col) => col.segments.filter((s) => s.height > 0));

  g.selectAll('.col-hover-target')
    .data(columns)
    .join('rect')
    .attr('class', 'col-hover-target')
    .attr('x', (d: ColumnData) => d.x)
    .attr('y', 0)
    .attr('width', (d: ColumnData) => Math.max(0, d.width))
    .attr('height', dims.innerHeight)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: ColumnData) {
      g.selectAll('.mekko-segment').attr('opacity', (s: SegmentData) =>
        s.primaryKey === d.primaryKey ? 1 : 0.3
      );

      const colPct = grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : '0.0';
      let html = `<strong>${d.primaryKey}</strong>`;
      html += `<br/><span style="color:${TEXT_MUTED};font-size:11px">Column total: ${formatValue(d.total)} (${colPct}%)</span>`;

      d.segments.filter(s => s.value > 0).forEach((seg) => {
        const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colorScale(seg.secondaryKey)};margin-right:4px"></span>`;
        html += `<br/>${swatch}${seg.secondaryKey}: ${formatValue(seg.value)} (${seg.pctOfColumn.toFixed(0)}%)`;
      });

      showTooltip(tooltip, html, event);
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      g.selectAll('.mekko-segment').attr('opacity', 1);
      hideTooltip(tooltip);
    });

  g.selectAll('.mekko-segment')
    .data(allSegments)
    .join('rect')
    .attr('class', 'mekko-segment')
    .attr('x', (d: SegmentData) => d.x)
    .attr('y', (d: SegmentData) => d.y)
    .attr('width', (d: SegmentData) => Math.max(0, d.width))
    .attr('height', (d: SegmentData) => Math.max(0, d.height))
    .attr('fill', (d: SegmentData) => colorScale(d.secondaryKey))
    .attr('stroke', DARK_BG)
    .attr('stroke-width', 1)
    .attr('pointer-events', 'none');

  const isSmall = dims.innerWidth < 350 || dims.innerHeight < 300;

  if ((showLabels || showPercentages) && !isSmall) {
    g.selectAll('.mekko-label')
      .data(allSegments)
      .join('text')
      .attr('class', 'mekko-label')
      .attr('x', (d: SegmentData) => d.x + d.width / 2)
      .attr('y', (d: SegmentData) => d.y + d.height / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', (d: SegmentData) => contrastText(colorScale(d.secondaryKey)))
      .attr('font-size', (d: SegmentData) => {
        const minDim = Math.min(d.width, d.height);
        return Math.max(9, Math.min(12, minDim / 4)) + 'px';
      })
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .text((d: SegmentData) => {
        if (d.width < 45 || d.height < 22) return '';

        const parts: string[] = [];
        const maxChars = Math.max(3, Math.floor(d.width / 8));
        if (showLabels && d.width >= 65 && d.height >= 30) {
          parts.push(truncateLabel(d.secondaryKey, Math.min(maxChars, Math.floor(d.width / 7))));
        }
        if (showPercentages && d.width >= 45 && d.height >= 22) {
          parts.push(d.pctOfColumn.toFixed(0) + '%');
        }
        const text = parts.join(' ');
        if (text.length * 6.5 > d.width - 4) return parts.length > 1 ? parts[parts.length - 1] : '';
        return text;
      });
  }

  const axisG = g.append('g');

  columns.forEach((col) => {
    const centerX = col.x + col.width / 2;
    const charWidth = 7;
    const maxChars = Math.max(3, Math.floor(col.width / charWidth));
    const label = truncateLabel(col.primaryKey, maxChars);
    const needsRotation = col.width < 40 && col.primaryKey.length > 3;

    const labelG = axisG
      .append('text')
      .attr('x', centerX)
      .attr('y', dims.innerHeight + 16)
      .attr('text-anchor', needsRotation ? 'end' : 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '11px')
      .attr('font-family', 'Inter, system-ui, sans-serif');

    if (needsRotation) {
      labelG
        .attr('transform', `rotate(-35, ${centerX}, ${dims.innerHeight + 16})`)
        .attr('dx', '-0.3em')
        .attr('dy', '0.15em');
    }

    labelG.text(label);
    if (col.primaryKey.length > maxChars) {
      labelG.append('title').text(col.primaryKey);
    }

    const colPct = grandTotal > 0 ? ((col.total / grandTotal) * 100).toFixed(0) + '%' : '';
    if (col.width >= 30) {
      axisG
        .append('text')
        .attr('x', centerX)
        .attr('y', dims.innerHeight + (needsRotation ? 28 : 30))
        .attr('text-anchor', 'middle')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '10px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('opacity', 0.6)
        .text(colPct);
    }
  });

  axisG
    .append('line')
    .attr('x1', 0)
    .attr('y1', dims.innerHeight)
    .attr('x2', dims.innerWidth)
    .attr('y2', dims.innerHeight)
    .attr('stroke', AXIS_COLOR)
    .attr('stroke-width', 0.5);

  addSortControls(svg, container, spec, dims, renderMarimekko);
}
