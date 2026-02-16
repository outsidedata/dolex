/**
 * Sankey diagram D3 renderer.
 */

import type { VisualizationSpec } from '../../../types.js';
import {
  createSvg,
  createTooltip,
  showTooltip,
  hideTooltip,
  positionTooltip,
  formatValue,
  renderEmptyState,
  isAllZeros,
  DEFAULT_PALETTE,
  TEXT_COLOR,
  truncateLabel,
} from '../shared.js';
import { computeSankeyLayout } from './sankey-layout.js';
import type { SankeyNode, SankeyLink } from './sankey-layout.js';

declare const d3: any;

export function renderSankey(container: HTMLElement, spec: VisualizationSpec): void {
  const { config, encoding, data } = spec;
  const sourceField = config.sourceField || encoding.source?.field;
  const targetField = config.targetField || encoding.target?.field;
  const valueField = config.valueField || encoding.size?.field;
  const nodeWidth = config.nodeWidth ?? 20;
  const nodePadding = config.nodePadding ?? 10;
  const linkOpacity = config.linkOpacity ?? 0.4;

  const { svg, g, dims } = createSvg(container, spec, { top: 40, left: 20, right: 20, bottom: 20 });
  const tooltip = createTooltip(container);

  // Check if all values are zero
  if (valueField && isAllZeros(data, valueField)) {
    renderEmptyState(g, dims);
    return;
  }

  // Build nodes and links from data or config
  let nodeNames: string[];
  let linkData: { source: string; target: string; value: number }[];

  if (config.nodes && config.links) {
    nodeNames = config.nodes.map((n: any) => n.name);
    linkData = config.links;
  } else {
    const sources = data.map((d) => String(d[sourceField]));
    const targets = data.map((d) => String(d[targetField]));
    nodeNames = [...new Set([...sources, ...targets])];
    linkData = data.map((d) => ({
      source: String(d[sourceField]),
      target: String(d[targetField]),
      value: Number(d[valueField]) || 1,
    }));
  }

  const { nodes, links } = computeSankeyLayout(
    nodeNames, linkData, dims.innerWidth, dims.innerHeight, nodeWidth, nodePadding
  );

  const nodeColorScale = d3.scaleOrdinal().domain(nodeNames).range(DEFAULT_PALETTE);

  drawLinks(g, links, nodeColorScale, linkOpacity, tooltip);
  drawNodes(g, nodes, nodeColorScale, dims, tooltip);

  if (config.showLabels !== false) {
    drawNodeLabels(g, nodes, config, dims);
  }
}

function drawLinks(
  g: any,
  links: SankeyLink[],
  colorScale: any,
  linkOpacity: number,
  tooltip: HTMLDivElement
): void {
  const linkPath = (link: SankeyLink) => {
    const sx = link.source.x1;
    const tx = link.target.x0;
    const mx = (sx + tx) / 2;
    const sy0 = link.y0;
    const ty0 = link.y1;
    const w = link.width;

    return `
      M ${sx},${sy0}
      C ${mx},${sy0} ${mx},${ty0} ${tx},${ty0}
      L ${tx},${ty0 + w}
      C ${mx},${ty0 + w} ${mx},${sy0 + w} ${sx},${sy0 + w}
      Z
    `;
  };

  g.selectAll('.sankey-link')
    .data(links)
    .join('path')
    .attr('class', 'sankey-link')
    .attr('d', linkPath)
    .attr('fill', (d: SankeyLink) => colorScale(d.source.name))
    .attr('opacity', linkOpacity)
    .attr('stroke', 'none')
    .on('mouseover', function (event: MouseEvent, d: SankeyLink) {
      d3.select(this).attr('opacity', linkOpacity + 0.3);
      showTooltip(
        tooltip,
        `<strong>${d.source.name} → ${d.target.name}</strong><br/>Value: ${formatValue(d.value)}`,
        event
      );
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', linkOpacity);
      hideTooltip(tooltip);
    });
}

function drawNodes(
  g: any,
  nodes: SankeyNode[],
  colorScale: any,
  dims: any,
  tooltip: HTMLDivElement
): void {
  g.selectAll('.sankey-node')
    .data(nodes)
    .join('rect')
    .attr('class', 'sankey-node')
    .attr('x', (d: SankeyNode) => d.x0)
    .attr('y', (d: SankeyNode) => d.y0)
    .attr('width', (d: SankeyNode) => d.x1 - d.x0)
    .attr('height', (d: SankeyNode) => Math.max(d.y1 - d.y0, 3))
    .attr('fill', (d: SankeyNode) => colorScale(d.name))
    .attr('rx', 2)
    .attr('stroke', '#0f1117')
    .attr('stroke-width', 1)
    .on('mouseover', function (event: MouseEvent, d: SankeyNode) {
      d3.select(this).attr('opacity', 0.8);
      const inflow = d.targetLinks.reduce((s, l) => s + l.value, 0);
      const outflow = d.sourceLinks.reduce((s, l) => s + l.value, 0);
      let html = `<strong>${d.name}</strong><br/>Total: ${formatValue(d.value)}`;
      if (inflow > 0) html += `<br/>Inflow: ${formatValue(inflow)}`;
      if (outflow > 0) html += `<br/>Outflow: ${formatValue(outflow)}`;
      showTooltip(tooltip, html, event);
    })
    .on('mousemove', (event: MouseEvent) => {
      positionTooltip(tooltip, event);
    })
    .on('mouseout', function () {
      d3.select(this).attr('opacity', 1);
      hideTooltip(tooltip);
    });
}

function drawNodeLabels(
  g: any,
  nodes: SankeyNode[],
  config: VisualizationSpec['config'],
  dims: any
): void {
  g.selectAll('.sankey-label')
    .data(nodes)
    .join('text')
    .attr('class', 'sankey-label')
    .attr('x', (d: SankeyNode) => {
      if (d.x0 < dims.innerWidth / 2) return d.x1 + 6;
      return d.x0 - 6;
    })
    .attr('y', (d: SankeyNode) => (d.y0 + d.y1) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d: SankeyNode) => (d.x0 < dims.innerWidth / 2 ? 'start' : 'end'))
    .attr('fill', TEXT_COLOR)
    .attr('font-size', '11px')
    .attr('font-family', 'Inter, system-ui, sans-serif')
    .text((d: SankeyNode) => {
      const isRight = d.x0 >= dims.innerWidth / 2;
      const availChars = isRight
        ? Math.max(10, Math.floor((d.x0 - 6) / 6.5))
        : Math.max(10, Math.floor((dims.innerWidth - d.x1 - 6) / 6.5));
      const label = truncateLabel(d.name, Math.min(availChars, 30));
      if (config.showValues !== false) return `${label} (${formatValue(d.value)})`;
      return label;
    });
}
