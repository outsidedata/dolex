/**
 * Chord diagram D3 renderer.
 *
 * Circular layout with arcs for groups and ribbons for flows
 * between groups. Uses d3.chord() and d3.ribbon().
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  buildColorScale,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  createLegend,
  DARK_BG,
  TEXT_COLOR,
  TEXT_MUTED,
  truncateTitle,
} from '../shared.js';

declare const d3: any;

export function renderChord(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const sourceField = config.sourceField || encoding.source?.field;
  const targetField = config.targetField || encoding.target?.field;
  const valueField = config.valueField || encoding.size?.field;
  const padAngle = config.padAngle ?? 0.02;
  const ribbonOpacity = config.ribbonOpacity ?? 0.6;
  const showValues = config.showValues === true;

  // ── Build NxN matrix ──
  const entitySet = new Set<string>();
  for (const row of data) {
    entitySet.add(String(row[sourceField]));
    entitySet.add(String(row[targetField]));
  }
  const entities = [...entitySet];
  const n = entities.length;

  if (n < 2) {
    container.innerHTML = '<p style="color:#ef4444;padding:20px;">Chord diagram requires at least 2 entities</p>';
    return;
  }

  const entityIndex = new Map<string, number>();
  entities.forEach((name, i) => entityIndex.set(name, i));

  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const row of data) {
    const si = entityIndex.get(String(row[sourceField]));
    const ti = entityIndex.get(String(row[targetField]));
    const raw = Number(row[valueField]);
    const val = isNaN(raw) ? 1 : raw;
    if (si !== undefined && ti !== undefined) {
      matrix[si][ti] += val;
    }
  }

  // Extreme-range guard: clamp minimum cell value to 2% of max so tiny flows remain visible
  let matrixMax = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (matrix[i][j] > matrixMax) matrixMax = matrix[i][j];
    }
  }
  const minVisibleChord = matrixMax * 0.02;
  if (matrixMax > 0) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i][j] > 0 && matrix[i][j] < minVisibleChord) {
          matrix[i][j] = minVisibleChord;
        }
      }
    }
  }

  // ── Color scale (supports palettes + highlight via buildColorScale) ──
  const colorField = encoding.color?.field || sourceField;
  const colorData = entities.map(name => ({ [colorField]: name }));
  const colorScale = buildColorScale(
    { ...(encoding.color || {}), field: colorField, type: encoding.color?.type || 'nominal' },
    colorData,
  );

  // ── Container layout: flex column (chartWrapper + legend) ──
  const containerWidth = container.clientWidth || 600;
  const containerHeight = container.clientHeight || 600;

  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = DARK_BG;
  container.style.borderRadius = '8px';
  container.style.overflow = 'hidden';

  const chartWrapper = document.createElement('div');
  chartWrapper.style.flex = '1';
  chartWrapper.style.minHeight = '0';
  container.appendChild(chartWrapper);

  const showLegend = containerHeight > 250 && containerWidth > 300;
  if (showLegend) {
    container.appendChild(createLegend(colorScale));
  }

  // ── SVG setup (radial, not cartesian) ──
  const width = chartWrapper.clientWidth || containerWidth;
  const height = chartWrapper.clientHeight || (containerHeight - (showLegend ? 40 : 0));

  const autoShowLabels = config.showLabels !== false && Math.min(width, height) > 250;
  const labelMargin = autoShowLabels ? Math.min(80, Math.max(40, 10 + n * 5)) : 20;
  const radius = Math.min(width, height) / 2 - labelMargin;
  const arcWidth = Math.max(12, Math.min(24, radius * 0.12));
  const innerRadius = radius - arcWidth;

  const tooltip = createTooltip(container);

  const svg = d3
    .select(chartWrapper)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  if (spec.title) {
    const titleEl = svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_COLOR)
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(spec.title);
    truncateTitle(titleEl, spec.title, width - 20);
  }

  const titleOffset = spec.title ? 20 : 0;
  const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2 + titleOffset})`);

  // Guard: if matrix is all zeros, show empty state
  const matrixSum = matrix.reduce((s, row) => s + row.reduce((rs, v) => rs + v, 0), 0);
  if (matrixSum === 0) {
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '14px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text('All values are zero');
    return;
  }

  // ── Compute chord layout ──
  const chordLayout = d3
    .chord()
    .padAngle(padAngle)
    .sortSubgroups(d3.descending);

  const chords = chordLayout(matrix);

  // ── Draw ribbons FIRST (behind arcs) ──
  const ribbon = d3.ribbon().radius(innerRadius);

  const ribbons = g
    .selectAll('.chord-ribbon')
    .data(chords)
    .join('path')
    .attr('class', 'chord-ribbon')
    .attr('d', ribbon)
    .attr('fill', (d: any) => colorScale(entities[d.source.index]))
    .attr('opacity', ribbonOpacity)
    .attr('stroke', 'none')
    .on('mouseover', function (event: MouseEvent, d: any) {
      // Dim all other ribbons, highlight this one
      ribbons.attr('opacity', (rd: any) =>
        rd === d ? Math.min(ribbonOpacity + 0.25, 0.9) : ribbonOpacity * 0.3,
      );
      const sourceName = entities[d.source.index];
      const targetName = entities[d.target.index];
      const val = d.source.value;
      let html = `<strong>${sourceName} \u2192 ${targetName}</strong><br/>Value: ${formatValue(val)}`;
      if (d.source.index !== d.target.index) {
        const reverseVal = matrix[d.target.index][d.source.index];
        if (reverseVal > 0) {
          html += `<br/>${targetName} \u2192 ${sourceName}: ${formatValue(reverseVal)}`;
        }
      }
      showTooltip(tooltip, html, event);
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      ribbons.attr('opacity', ribbonOpacity);
      hideTooltip(tooltip);
    });

  // ── Draw arcs ON TOP ──
  const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);

  const arcGroups = g
    .selectAll('.chord-group')
    .data(chords.groups)
    .join('g')
    .attr('class', 'chord-group');

  arcGroups
    .append('path')
    .attr('d', arc)
    .attr('fill', (d: any) => colorScale(entities[d.index]))
    .attr('stroke', DARK_BG)
    .attr('stroke-width', 1.5)
    .on('mouseover', function (event: MouseEvent, d: any) {
      d3.select(this).attr('opacity', 0.85);
      // Highlight ribbons connected to this group, dim others
      ribbons.attr('opacity', (rd: any) =>
        rd.source.index === d.index || rd.target.index === d.index
          ? Math.min(ribbonOpacity + 0.25, 0.9)
          : ribbonOpacity * 0.2,
      );
      const total = d.value;
      showTooltip(tooltip, `<strong>${entities[d.index]}</strong><br/>Total flow: ${formatValue(total)}`, event);
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1);
      ribbons.attr('opacity', ribbonOpacity);
      hideTooltip(tooltip);
    });

  // ── Labels along arcs ──
  if (autoShowLabels) {
    const labelFontSize = n > 10 ? 9 : n > 6 ? 10 : 11;
    const maxLabelLen = n > 10 ? 12 : n > 6 ? 14 : 18;

    arcGroups
      .append('text')
      .each(function (d: any) {
        d._midAngle = (d.startAngle + d.endAngle) / 2;
      })
      .attr('transform', function (d: any) {
        const angle = d._midAngle;
        const labelRadius = radius + 8;
        const x = Math.sin(angle) * labelRadius;
        const y = -Math.cos(angle) * labelRadius;
        return `translate(${x},${y})`;
      })
      .attr('text-anchor', function (d: any) {
        const s = Math.sin(d._midAngle);
        if (s > 0.3) return 'start';   // right side
        if (s < -0.3) return 'end';    // left side
        return 'middle';               // top / bottom
      })
      .attr('dy', function (d: any) {
        const c = Math.cos(d._midAngle);
        if (c > 0.5) return '-0.1em';  // top: text above anchor
        if (c < -0.5) return '0.9em';  // bottom: text below anchor
        return '0.35em';               // sides: centered
      })
      .attr('fill', TEXT_COLOR)
      .attr('font-size', `${labelFontSize}px`)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        // Hide label if arc span is too narrow
        if (d.endAngle - d.startAngle < 0.1) return '';
        const name = entities[d.index];
        const label = name.length > maxLabelLen ? name.slice(0, maxLabelLen - 1) + '\u2026' : name;
        if (showValues) return `${label} (${formatValue(d.value)})`;
        return label;
      });
  }
}

