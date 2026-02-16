/**
 * Slope chart D3 renderer.
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
  truncateLabel,
  TEXT_COLOR,
  GRID_COLOR,
  DARK_BG,
} from '../shared.js';

declare const d3: any;

/**
 * Push overlapping labels apart vertically with bounds clamping.
 * Labels must be sorted by y before calling.
 */
function resolveCollisions(
  labels: { y: number }[],
  minSpacing: number,
  minY?: number,
  maxY?: number
): void {
  const passes = Math.min(labels.length, 8);
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 1; i < labels.length; i++) {
      const overlap = labels[i - 1].y + minSpacing - labels[i].y;
      if (overlap > 0) {
        labels[i - 1].y -= overlap / 2;
        labels[i].y += overlap / 2;
      }
    }
  }
  // Forward pass to enforce ordering
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y < labels[i - 1].y + minSpacing) {
      labels[i].y = labels[i - 1].y + minSpacing;
    }
  }
  // Clamp to bounds
  if (minY != null || maxY != null) {
    if (maxY != null && labels.length > 0 && labels[labels.length - 1].y > maxY) {
      labels[labels.length - 1].y = maxY;
      for (let i = labels.length - 2; i >= 0; i--) {
        if (labels[i].y > labels[i + 1].y - minSpacing) {
          labels[i].y = labels[i + 1].y - minSpacing;
        }
      }
    }
    if (minY != null && labels.length > 0 && labels[0].y < minY) {
      labels[0].y = minY;
      for (let i = 1; i < labels.length; i++) {
        if (labels[i].y < labels[i - 1].y + minSpacing) {
          labels[i].y = labels[i - 1].y + minSpacing;
        }
      }
    }
  }
}

export function renderSlopeChart(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const categoryField = config.categoryField || encoding.color?.field;
  const valueField = config.valueField || encoding.y?.field;
  const timeField = config.timeField || encoding.x?.field;
  const periods: string[] = config.periods || [...new Set(data.map((d) => d[timeField]))].slice(0, 2);

  const categories = [...new Set(data.map((d) => d[categoryField]))];
  const maxCatLen = Math.max(...categories.map(c => String(c).length));
  const truncLen = Math.min(maxCatLen, 20);
  const leftMarginEstimate = Math.max(100, Math.min(200, truncLen * 7 + 60));
  const { svg, g, dims } = createSvg(container, spec, { left: leftMarginEstimate, right: 100 });
  const tooltip = createTooltip(container);

  // Group data by category (categories already computed above for margin)
  const grouped: Record<string, Record<string, number>> = {};
  categories.forEach((cat) => {
    grouped[cat as string] = {};
    data
      .filter((d) => d[categoryField] === cat)
      .forEach((d) => {
        grouped[cat as string][d[timeField]] = Number(d[valueField]);
      });
  });

  // Y scale based on all values
  const allValues = data.map((d) => Number(d[valueField]));
  const yScale = d3
    .scaleLinear()
    .domain([d3.min(allValues) * 0.9, d3.max(allValues) * 1.1])
    .range([dims.innerHeight, 0])
    .nice();

  const xScale = d3.scalePoint().domain(periods).range([0, dims.innerWidth]).padding(0);
  const colorScale = buildColorScale(encoding.color, data);

  // Vertical lines at each period
  periods.forEach((period) => {
    g.append('line')
      .attr('x1', xScale(period))
      .attr('y1', 0)
      .attr('x2', xScale(period))
      .attr('y2', dims.innerHeight)
      .attr('stroke', GRID_COLOR)
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', xScale(period))
      .attr('y', dims.innerHeight + 25)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(String(period));
  });

  if (periods.length <= 1) {
    const singlePeriod = periods[0];
    const dotX = dims.innerWidth / 2;

    const singleData = categories
      .map((cat) => {
        const catStr = cat as string;
        const vals = grouped[catStr];
        if (vals[singlePeriod] == null) return null;
        return {
          category: catStr,
          value: vals[singlePeriod],
          color: colorScale(cat),
        };
      })
      .filter(Boolean) as { category: string; value: number; color: string }[];

    const minLabelSpacing = 14;
    const labels = singleData
      .map((d) => ({ ...d, y: yScale(d.value) }))
      .sort((a, b) => a.y - b.y);
    resolveCollisions(labels, minLabelSpacing, 0, dims.innerHeight - 10);

    labels.forEach((d) => {
      g.append('circle')
        .attr('cx', dotX)
        .attr('cy', yScale(d.value))
        .attr('r', 6)
        .attr('fill', d.color)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 2)
        .attr('cursor', 'pointer')
        .on('mouseover', function (event: MouseEvent) {
          d3.select(this).attr('r', 8);
          showTooltip(
            tooltip,
            `<strong>${d.category}</strong><br/>${singlePeriod}: ${formatValue(d.value)}`,
            event
          );
        })
        .on('mousemove', (event: MouseEvent) => {
          positionTooltip(tooltip, event);
        })
        .on('mouseout', function () {
          d3.select(this).attr('r', 6);
          hideTooltip(tooltip);
        });

      g.append('text')
        .attr('x', dotX - 14)
        .attr('y', d.y + 4)
        .attr('text-anchor', 'end')
        .attr('fill', d.color)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(d.category);

      g.append('text')
        .attr('x', dotX + 14)
        .attr('y', d.y + 4)
        .attr('text-anchor', 'start')
        .attr('fill', d.color)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(formatValue(d.value));
    });

    return;
  }

  // Build line data for hover targets and visuals
  const lineData = categories
    .map((cat) => {
      const catStr = cat as string;
      const vals = grouped[catStr];
      if (vals[periods[0]] == null || vals[periods[1]] == null) return null;
      return {
        category: catStr,
        vals,
        y1: yScale(vals[periods[0]]),
        y2: yScale(vals[periods[1]]),
        color: colorScale(cat),
      };
    })
    .filter(Boolean) as { category: string; vals: Record<string, number>; y1: number; y2: number; color: string }[];

  // Invisible wide hover targets (drawn first, behind everything)
  lineData.forEach((d) => {
    g.append('line')
      .attr('class', 'slope-hover-target')
      .attr('x1', xScale(periods[0]))
      .attr('y1', d.y1)
      .attr('x2', xScale(periods[1]))
      .attr('y2', d.y2)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: MouseEvent) {
        g.select(`.slope-line-${CSS.escape(d.category)}`).attr('stroke-width', 4).attr('opacity', 1);
        g.selectAll(`.slope-dot-${CSS.escape(d.category)}`).attr('r', 6);
        const change = d.vals[periods[1]] - d.vals[periods[0]];
        const pctChange = ((change / d.vals[periods[0]]) * 100).toFixed(1);
        showTooltip(
          tooltip,
          `<strong>${d.category}</strong><br/>${periods[0]}: ${formatValue(d.vals[periods[0]])}<br/>${periods[1]}: ${formatValue(d.vals[periods[1]])}<br/>Change: ${change >= 0 ? '+' : ''}${pctChange}%`,
          event
        );
      })
      .on('mousemove', (event: MouseEvent) => {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', function () {
        g.select(`.slope-line-${CSS.escape(d.category)}`).attr('stroke-width', 2.5).attr('opacity', 0.8);
        g.selectAll(`.slope-dot-${CSS.escape(d.category)}`).attr('r', 5);
        hideTooltip(tooltip);
      });
  });

  // Draw visible slope lines
  lineData.forEach((d) => {
    g.append('line')
      .attr('class', `slope-line-${d.category}`)
      .attr('x1', xScale(periods[0]))
      .attr('y1', d.y1)
      .attr('x2', xScale(periods[1]))
      .attr('y2', d.y2)
      .attr('stroke', d.color)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.8)
      .attr('pointer-events', 'none');

    // Dots at endpoints
    [periods[0], periods[1]].forEach((period) => {
      g.append('circle')
        .attr('class', `slope-dot-${d.category}`)
        .attr('cx', xScale(period))
        .attr('cy', yScale(d.vals[period]))
        .attr('r', 5)
        .attr('fill', d.color)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    });
  });

  // Labels with collision avoidance
  if (config.showLabels !== false) {
    const isMany = lineData.length > 15;
    const fontSize = isMany ? '9px' : '11px';
    const minLabelSpacing = isMany ? 10 : 12;
    const labelBoundsMin = 0;
    const labelBoundsMax = dims.innerHeight - 10;
    const maxLeftChars = isMany ? 12 : truncLen;

    // Left labels: nudge overlapping labels apart
    const leftLabels = lineData
      .map((d) => ({ category: d.category, y: d.y1, value: d.vals[periods[0]], color: d.color }))
      .sort((a, b) => a.y - b.y);
    resolveCollisions(leftLabels, minLabelSpacing, labelBoundsMin, labelBoundsMax);

    leftLabels.forEach((lbl) => {
      const catLabel = lbl.category.length > maxLeftChars
        ? lbl.category.slice(0, maxLeftChars - 1) + '\u2026'
        : lbl.category;
      g.append('text')
        .attr('x', xScale(periods[0])! - 10)
        .attr('y', lbl.y + 4)
        .attr('text-anchor', 'end')
        .attr('fill', lbl.color)
        .attr('font-size', fontSize)
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(`${catLabel} (${formatValue(lbl.value)})`);
    });

    // Right labels
    const rightLabels = lineData
      .map((d) => ({ category: d.category, y: d.y2, value: d.vals[periods[1]], color: d.color }))
      .sort((a, b) => a.y - b.y);
    resolveCollisions(rightLabels, minLabelSpacing, labelBoundsMin, labelBoundsMax);

    rightLabels.forEach((lbl) => {
      g.append('text')
        .attr('x', xScale(periods[1])! + 10)
        .attr('y', lbl.y + 4)
        .attr('text-anchor', 'start')
        .attr('fill', lbl.color)
        .attr('font-size', fontSize)
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(formatValue(lbl.value));
    });
  }
}
