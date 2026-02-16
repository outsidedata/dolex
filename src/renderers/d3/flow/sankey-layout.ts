/**
 * Simplified sankey layout computation.
 *
 * Assigns nodes to layers via topological ordering,
 * then positions nodes and links within available space.
 * Extracted from the sankey renderer for clarity.
 */

declare const d3: any;

export interface SankeyNode {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  value: number;
  sourceLinks: SankeyLink[];
  targetLinks: SankeyLink[];
  layer: number;
}

export interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  value: number;
  width: number;
  y0: number;
  y1: number;
}

export function computeSankeyLayout(
  nodeNames: string[],
  linkData: { source: string; target: string; value: number }[],
  width: number,
  height: number,
  nodeWidth: number,
  nodePadding: number
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  // Create node map
  const nodeMap = new Map<string, SankeyNode>();
  nodeNames.forEach((name) => {
    nodeMap.set(name, {
      name,
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 0,
      value: 0,
      sourceLinks: [],
      targetLinks: [],
      layer: 0,
    });
  });

  // Create links
  const links: SankeyLink[] = linkData
    .map((l) => {
      const source = nodeMap.get(l.source);
      const target = nodeMap.get(l.target);
      if (!source || !target) return null;
      const link: SankeyLink = {
        source,
        target,
        value: l.value,
        width: 0,
        y0: 0,
        y1: 0,
      };
      source.sourceLinks.push(link);
      target.targetLinks.push(link);
      return link;
    })
    .filter(Boolean) as SankeyLink[];

  const nodes = [...nodeMap.values()];

  computeNodeValues(nodes);
  assignLayers(nodes);
  positionNodes(nodes, width, height, nodeWidth, nodePadding);
  computeLinkPositions(nodes, links);

  return { nodes, links };
}

function computeNodeValues(nodes: SankeyNode[]): void {
  nodes.forEach((node) => {
    const outSum = node.sourceLinks.reduce((s, l) => s + l.value, 0);
    const inSum = node.targetLinks.reduce((s, l) => s + l.value, 0);
    node.value = Math.max(outSum, inSum);
  });
}

function assignLayers(nodes: SankeyNode[]): void {
  const sources = nodes.filter((n) => n.targetLinks.length === 0);
  const visited = new Set<string>();
  const queue = sources.map((n) => ({ node: n, layer: 0 }));

  while (queue.length > 0) {
    const { node, layer } = queue.shift()!;
    if (visited.has(node.name)) continue;
    visited.add(node.name);
    node.layer = layer;

    node.sourceLinks.forEach((link) => {
      if (!visited.has(link.target.name)) {
        queue.push({ node: link.target, layer: layer + 1 });
      }
    });
  }

  // Handle unvisited nodes (cycles or disconnected)
  nodes.forEach((n) => {
    if (!visited.has(n.name)) {
      n.layer = 0;
      visited.add(n.name);
    }
  });
}

function positionNodes(
  nodes: SankeyNode[],
  width: number,
  height: number,
  nodeWidth: number,
  nodePadding: number
): void {
  const maxLayer = d3.max(nodes, (n: SankeyNode) => n.layer) || 0;
  const layerGap = maxLayer > 0 ? (width - nodeWidth) / maxLayer : 0;

  // Assign x positions
  nodes.forEach((node) => {
    node.x0 = node.layer * layerGap;
    node.x1 = node.x0 + nodeWidth;
  });

  // Group by layer and assign y positions
  const layers: SankeyNode[][] = [];
  for (let i = 0; i <= maxLayer; i++) {
    layers[i] = nodes.filter((n) => n.layer === i);
  }

  layers.forEach((layerNodes) => {
    layerNodes.sort((a, b) => b.value - a.value);

    const totalValue = layerNodes.reduce((s, n) => s + n.value, 0);
    const totalPadding = (layerNodes.length - 1) * nodePadding;
    const availableHeight = height - totalPadding;
    const scale = totalValue > 0 ? availableHeight / totalValue : 1;

    const MIN_NODE_HEIGHT = 3;
    let y = 0;
    layerNodes.forEach((node) => {
      node.y0 = y;
      node.y1 = y + Math.max(node.value * scale, MIN_NODE_HEIGHT);
      y = node.y1 + nodePadding;
    });

    // Compress if exceeding height
    const excess = y - nodePadding - height;
    if (excess > 0 && layerNodes.length > 0) {
      const compressionFactor = height / (y - nodePadding);
      let cy = 0;
      layerNodes.forEach((node) => {
        const h = (node.y1 - node.y0) * compressionFactor;
        node.y0 = cy;
        node.y1 = cy + h;
        cy += h + nodePadding * compressionFactor;
      });
    }
  });
}

function computeLinkPositions(nodes: SankeyNode[], links: SankeyLink[]): void {
  const MIN_LINK_WIDTH = 2;

  links.forEach((link) => {
    const sourceTotal = link.source.value || 1;
    const sourceHeight = link.source.y1 - link.source.y0;
    link.width = Math.max((link.value / sourceTotal) * sourceHeight, MIN_LINK_WIDTH);
  });

  nodes.forEach((node) => {
    let sy = node.y0;
    node.sourceLinks.sort((a, b) => a.target.y0 - b.target.y0);
    node.sourceLinks.forEach((link) => {
      link.y0 = sy;
      sy += link.width;
    });

    let ty = node.y0;
    node.targetLinks.sort((a, b) => a.source.y0 - b.source.y0);
    node.targetLinks.forEach((link) => {
      const targetTotal = node.value || 1;
      const targetHeight = node.y1 - node.y0;
      const w = Math.max((link.value / targetTotal) * targetHeight, MIN_LINK_WIDTH);
      link.y1 = ty;
      link.width = Math.min(link.width, w) || link.width;
      ty += w;
    });
  });
}
