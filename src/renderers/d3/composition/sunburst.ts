/**
 * Sunburst D3 renderer.
 *
 * Concentric rings from hierarchical data. Inner ring = top-level categories,
 * outer rings = deeper levels. Each node is an arc segment.
 *
 * Layout: flex column — title (HTML) → SVG chart → HTML legend.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  buildColorScale,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  truncateLabel,
  contrastText,
  contrastTextMuted,
  isAllZeros,
  DEFAULT_PALETTE,
  DARK_BG,
  TEXT_COLOR,
  TEXT_MUTED,
  createLegend,
} from '../shared.js';

declare const d3: any;

export function renderSunburst(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const parentField = config.parentField;
  const childField = config.childField;
  const valueField = config.valueField || encoding.size?.field;
  const showLabels = config.showLabels ?? true;
  const showValues = config.showValues ?? false;
  const innerR = config.innerRadius ?? 0;

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 600;

  // ── Flex column container ──
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.background = DARK_BG;
  container.style.borderRadius = '8px';
  container.style.overflow = 'hidden';
  container.style.fontFamily = 'Inter, system-ui, sans-serif';

  // ── Title (HTML div) ──
  const titleHeight = spec.title ? 36 : 0;
  if (spec.title) {
    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
      text-align: center;
      color: ${TEXT_COLOR};
      font-size: 14px;
      font-weight: 600;
      line-height: 36px;
      height: 36px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 10px;
    `;
    titleDiv.textContent = spec.title;
    titleDiv.title = spec.title;
    container.appendChild(titleDiv);
  }

  // ── Chart wrapper (takes remaining space) ──
  const chartWrapper = document.createElement('div');
  chartWrapper.style.cssText = `flex: 1; min-height: 0; position: relative;`;
  container.appendChild(chartWrapper);

  // Compute available chart area
  const legendEstimate = 32; // reserve space for legend row
  const chartHeight = height - titleHeight - legendEstimate;
  const chartPad = 12;
  const radius = Math.min(width - chartPad * 2, chartHeight - chartPad * 2) / 2;

  const svg = d3
    .select(chartWrapper)
    .append('svg')
    .attr('width', width)
    .attr('height', chartHeight);

  const centerX = width / 2;
  const centerY = chartHeight / 2;
  const g = svg.append('g').attr('transform', `translate(${centerX},${centerY})`);

  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (valueField && isAllZeros(data, valueField)) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${width}px;
      height: ${chartHeight}px;
      color: ${TEXT_MUTED};
      font-size: 14px;
      font-family: Inter, system-ui, sans-serif;
    `;
    emptyDiv.textContent = 'All values are zero';
    chartWrapper.appendChild(emptyDiv);
    return;
  }

  // ── Build hierarchy ──
  const root = buildHierarchy(data, parentField, childField, valueField, config);

  // ── Partition layout ──
  const effectiveInner = Math.min(innerR, radius * 0.6);
  d3.partition().size([2 * Math.PI, radius - effectiveInner])(root);

  // ── Color scale ──
  const topLevelNames = root.children ? root.children.map((c: any) => c.data.name) : [];
  const colorScale = encoding.color
    ? buildColorScale(encoding.color, data)
    : d3.scaleOrdinal().domain(topLevelNames).range(DEFAULT_PALETTE);

  // ── Arc generator ──
  const arc = d3
    .arc()
    .startAngle((d: any) => d.x0)
    .endAngle((d: any) => d.x1)
    .innerRadius((d: any) => d.y0 + effectiveInner)
    .outerRadius((d: any) => d.y1 + effectiveInner);

  // ── Draw arcs ──
  const descendants = root.descendants().filter((d: any) => d.depth > 0);

  const arcs = g
    .selectAll('.sunburst-arc')
    .data(descendants)
    .join('path')
    .attr('class', 'sunburst-arc')
    .attr('d', (d: any) =>
      d3.arc()
        .startAngle(d.x0)
        .endAngle(d.x1)
        .innerRadius(d.y0 + effectiveInner)
        .outerRadius(d.y1 + effectiveInner)
        .cornerRadius(d.depth * 3)(d)
    )
    .attr('fill', (d: any) => getArcColor(d, colorScale))
    .attr('stroke', DARK_BG)
    .attr('stroke-width', 1)
    .attr('opacity', 1)
    .style('cursor', 'pointer')
    .on('mouseover', function (event: MouseEvent, d: any) {
      // Dim all arcs, highlight this one + its ancestor chain
      arcs.attr('opacity', 0.3);
      const ancestors = getAncestorChain(d);
      arcs
        .filter((n: any) => ancestors.has(n) || n === d)
        .attr('opacity', 1);
      d3.select(this).attr('stroke', '#ffffff').attr('stroke-width', 2);

      const path = getAncestorPath(d);
      showTooltip(
        tooltip,
        `<strong>${path}</strong><br/>${valueField}: ${formatValue(d.value)}`,
        event
      );
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      arcs.attr('opacity', 1).attr('stroke', DARK_BG).attr('stroke-width', 1);
      hideTooltip(tooltip);
    });

  // ── Labels (skip on small charts) ──
  if (showLabels && radius > 140) {
    drawArcLabels(g, descendants, arc, showValues, colorScale, radius, 0);
  }

  // ── Center label (donut mode) ──
  if (effectiveInner > 30) {
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', TEXT_MUTED)
      .attr('font-size', '12px')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text(`Total: ${formatValue(root.value)}`);
  }

  if (topLevelNames.length > 1) {
    const legendDiv = createLegend(colorScale);
    container.appendChild(legendDiv);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getArcColor(d: any, colorScale: any): string {
  const ancestor = getTopAncestor(d);
  const baseColor = colorScale(ancestor.data.name);
  if (d.depth > 1) {
    const lightenFactor = Math.min(d.depth * 0.12, 0.4);
    return d3.interpolateRgb(baseColor, '#ffffff')(lightenFactor);
  }
  return baseColor;
}

function buildNestedHierarchy(
  items: Record<string, any>[],
  levelFields: string[],
  valueField: string,
  levelIdx: number,
  clampVal: (v: number) => number
): any[] {
  const field = levelFields[levelIdx];
  const groups = [...new Set(items.map((d) => d[field]))];

  if (levelIdx === levelFields.length - 1) {
    return groups.map((name) => ({
      name,
      value: clampVal(items
        .filter((d) => d[field] === name)
        .reduce((sum, d) => sum + (Number(d[valueField]) || 0), 0)),
      _data: items.find((d) => d[field] === name),
    }));
  }

  return groups.map((name) => ({
    name,
    children: buildNestedHierarchy(
      items.filter((d) => d[field] === name),
      levelFields,
      valueField,
      levelIdx + 1,
      clampVal
    ),
  }));
}

function buildHierarchy(
  data: Record<string, any>[],
  parentField: string | undefined,
  childField: string | undefined,
  valueField: string | undefined,
  config: VisualizationSpec['config']
): any {
  const levelFields: string[] | undefined = config.levelFields;

  // Compute min-visible threshold: 2% of max ensures extreme-range items stay visible
  const allVals = valueField
    ? data.map((d) => Number(d[valueField]) || 0).filter((v) => v > 0)
    : [];
  const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
  const minVisible = maxVal * 0.02;
  const clampVal = (v: number) => (v > 0 && v < minVisible ? minVisible : v);

  if (levelFields && levelFields.length > 0 && valueField) {
    const hierarchy = {
      name: 'root',
      children: buildNestedHierarchy(data, levelFields, valueField, 0, clampVal),
    };
    return d3.hierarchy(hierarchy).sum((d: any) => d.value);
  }

  if (parentField && childField && valueField) {
    const parents = [...new Set(data.map((d) => d[parentField]))];
    const hierarchy = {
      name: 'root',
      children: parents.map((p) => ({
        name: p,
        children: data
          .filter((d) => d[parentField] === p)
          .map((d) => ({
            name: d[childField],
            value: clampVal(Number(d[valueField]) || 0),
            _data: d,
          })),
      })),
    };
    return d3.hierarchy(hierarchy).sum((d: any) => d.value);
  }

  if (parentField && valueField) {
    const parents = [...new Set(data.map((d) => d[parentField]))];
    const hierarchy = {
      name: 'root',
      children: parents.map((p) => {
        const items = data.filter((d) => d[parentField] === p);
        return {
          name: p,
          children: items.map((d, i) => ({
            name: d[childField || parentField] || `Item ${i}`,
            value: clampVal(Number(d[valueField]) || 0),
            _data: d,
          })),
        };
      }),
    };
    return d3.hierarchy(hierarchy).sum((d: any) => d.value);
  }

  const categoryField = config.categoryField || childField || parentField;
  const hierarchy = {
    name: 'root',
    children: data.map((d) => ({
      name: d[categoryField!] || 'Unknown',
      value: clampVal(Number(d[valueField!]) || 0),
      _data: d,
    })),
  };
  return d3.hierarchy(hierarchy).sum((d: any) => d.value);
}

function getTopAncestor(d: any): any {
  let node = d;
  while (node.parent && node.parent.parent) {
    node = node.parent;
  }
  return node;
}

function getAncestorChain(d: any): Set<any> {
  const chain = new Set<any>();
  let node = d.parent;
  while (node && node.depth > 0) {
    chain.add(node);
    node = node.parent;
  }
  return chain;
}

function getAncestorPath(d: any): string {
  const parts: string[] = [];
  let node = d;
  while (node && node.depth > 0) {
    parts.unshift(node.data.name);
    node = node.parent;
  }
  return parts.join(' \u203A ');
}

function drawArcLabels(
  g: any,
  descendants: any[],
  arc: any,
  showValues: boolean,
  colorScale: any,
  _radius: number,
  _effectiveInner: number
): void {
  const labels = g
    .selectAll('.sunburst-label')
    .data(descendants)
    .join('text')
    .attr('class', 'sunburst-label')
    .attr('transform', (d: any) => {
      const [x, y] = arc.centroid(d);
      return `translate(${x},${y})`;
    })
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-family', 'Inter, system-ui, sans-serif')
    .attr('pointer-events', 'none');

  labels.each(function (this: SVGTextElement, d: any) {
    const el = d3.select(this);
    const angle = d.x1 - d.x0;
    const thickness = d.y1 - d.y0;
    if (angle < 0.12 || thickness < 18) return;

    const fillColor = getArcColor(d, colorScale);
    const isLarge = angle >= 0.25 && thickness >= 25;
    const fontSize = isLarge ? '12px' : '10px';
    const maxChars = Math.max(3, Math.floor(angle * 12));
    const rawName = String(d.data.name);
    if (rawName.length > maxChars) return;

    el.append('tspan')
      .attr('x', 0)
      .attr('dy', showValues && angle > 0.3 ? '-0.35em' : '0em')
      .attr('fill', contrastText(fillColor))
      .attr('font-size', fontSize)
      .attr('font-weight', '600')
      .text(rawName);

    if (showValues && angle > 0.3) {
      const valueFontSize = isLarge ? '11px' : '9px';
      el.append('tspan')
        .attr('x', 0)
        .attr('dy', '1.2em')
        .attr('fill', contrastTextMuted(fillColor))
        .attr('font-size', valueFontSize)
        .attr('font-weight', '400')
        .text(formatValue(d.value));
    }
  });
}
