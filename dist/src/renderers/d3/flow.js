/**
 * Flow renderers — sankey.
 *
 * Uses a custom simplified sankey layout since d3-sankey
 * may not be available. The layout computes node positions
 * and link paths from source/target/value data.
 */
import { createSvg, createTooltip, showTooltip, hideTooltip, formatValue, DEFAULT_PALETTE, TEXT_COLOR, } from './shared.js';
export function renderSankey(container, spec) {
    const { config, encoding, data } = spec;
    const sourceField = config.sourceField || encoding.source?.field;
    const targetField = config.targetField || encoding.target?.field;
    const valueField = config.valueField || encoding.size?.field;
    const nodeWidth = config.nodeWidth ?? 20;
    const nodePadding = config.nodePadding ?? 10;
    const linkOpacity = config.linkOpacity ?? 0.4;
    const { svg, g, dims } = createSvg(container, spec, { top: 40, left: 20, right: 20, bottom: 20 });
    const tooltip = createTooltip(container);
    // Build nodes and links from data or config
    let nodeNames;
    let linkData;
    if (config.nodes && config.links) {
        nodeNames = config.nodes.map((n) => n.name);
        linkData = config.links;
    }
    else {
        // Build from raw data
        const sources = data.map((d) => String(d[sourceField]));
        const targets = data.map((d) => String(d[targetField]));
        nodeNames = [...new Set([...sources, ...targets])];
        linkData = data.map((d) => ({
            source: String(d[sourceField]),
            target: String(d[targetField]),
            value: Number(d[valueField]) || 1,
        }));
    }
    // Compute layout
    const { nodes, links } = computeSankeyLayout(nodeNames, linkData, dims.innerWidth, dims.innerHeight, nodeWidth, nodePadding);
    // Color scale for nodes
    const nodeColorScale = d3.scaleOrdinal().domain(nodeNames).range(DEFAULT_PALETTE);
    // Draw links
    const linkPath = (link) => {
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
        .attr('fill', (d) => nodeColorScale(d.source.name))
        .attr('opacity', linkOpacity)
        .attr('stroke', 'none')
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', linkOpacity + 0.3);
        showTooltip(tooltip, `<strong>${d.source.name} → ${d.target.name}</strong><br/>Value: ${formatValue(d.value)}`, event);
    })
        .on('mousemove', (event) => {
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 12 + 'px';
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', linkOpacity);
        hideTooltip(tooltip);
    });
    // Draw nodes
    g.selectAll('.sankey-node')
        .data(nodes)
        .join('rect')
        .attr('class', 'sankey-node')
        .attr('x', (d) => d.x0)
        .attr('y', (d) => d.y0)
        .attr('width', (d) => d.x1 - d.x0)
        .attr('height', (d) => Math.max(d.y1 - d.y0, 1))
        .attr('fill', (d) => nodeColorScale(d.name))
        .attr('rx', 2)
        .attr('stroke', '#0f1117')
        .attr('stroke-width', 1)
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        const inflow = d.targetLinks.reduce((s, l) => s + l.value, 0);
        const outflow = d.sourceLinks.reduce((s, l) => s + l.value, 0);
        let html = `<strong>${d.name}</strong><br/>Total: ${formatValue(d.value)}`;
        if (inflow > 0)
            html += `<br/>Inflow: ${formatValue(inflow)}`;
        if (outflow > 0)
            html += `<br/>Outflow: ${formatValue(outflow)}`;
        showTooltip(tooltip, html, event);
    })
        .on('mousemove', (event) => {
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 12 + 'px';
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        hideTooltip(tooltip);
    });
    // Node labels
    if (config.showLabels !== false) {
        g.selectAll('.sankey-label')
            .data(nodes)
            .join('text')
            .attr('class', 'sankey-label')
            .attr('x', (d) => {
            // Label on the right for left-side nodes, left for right-side nodes
            if (d.x0 < dims.innerWidth / 2)
                return d.x1 + 6;
            return d.x0 - 6;
        })
            .attr('y', (d) => (d.y0 + d.y1) / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', (d) => (d.x0 < dims.innerWidth / 2 ? 'start' : 'end'))
            .attr('fill', TEXT_COLOR)
            .attr('font-size', '11px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text((d) => {
            const label = d.name;
            if (config.showValues !== false)
                return `${label} (${formatValue(d.value)})`;
            return label;
        });
    }
}
/**
 * Simplified sankey layout computation.
 * Assigns nodes to layers via topological ordering,
 * then positions nodes and links within available space.
 */
function computeSankeyLayout(nodeNames, linkData, width, height, nodeWidth, nodePadding) {
    // Create node map
    const nodeMap = new Map();
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
    const links = linkData
        .map((l) => {
        const source = nodeMap.get(l.source);
        const target = nodeMap.get(l.target);
        if (!source || !target)
            return null;
        const link = {
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
        .filter(Boolean);
    const nodes = [...nodeMap.values()];
    // Compute node values
    nodes.forEach((node) => {
        const outSum = node.sourceLinks.reduce((s, l) => s + l.value, 0);
        const inSum = node.targetLinks.reduce((s, l) => s + l.value, 0);
        node.value = Math.max(outSum, inSum);
    });
    // Assign layers via topological order (BFS from sources)
    const sources = nodes.filter((n) => n.targetLinks.length === 0);
    const visited = new Set();
    const queue = sources.map((n) => ({ node: n, layer: 0 }));
    while (queue.length > 0) {
        const { node, layer } = queue.shift();
        if (visited.has(node.name))
            continue;
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
    // Group by layer
    const maxLayer = d3.max(nodes, (n) => n.layer) || 0;
    const layerGap = maxLayer > 0 ? (width - nodeWidth) / maxLayer : 0;
    // Assign x positions
    nodes.forEach((node) => {
        node.x0 = node.layer * layerGap;
        node.x1 = node.x0 + nodeWidth;
    });
    // Assign y positions within each layer
    const layers = [];
    for (let i = 0; i <= maxLayer; i++) {
        layers[i] = nodes.filter((n) => n.layer === i);
    }
    layers.forEach((layerNodes) => {
        // Sort by total value descending for better layout
        layerNodes.sort((a, b) => b.value - a.value);
        const totalValue = layerNodes.reduce((s, n) => s + n.value, 0);
        const totalPadding = (layerNodes.length - 1) * nodePadding;
        const availableHeight = height - totalPadding;
        const scale = totalValue > 0 ? availableHeight / totalValue : 1;
        let y = 0;
        layerNodes.forEach((node) => {
            node.y0 = y;
            node.y1 = y + Math.max(node.value * scale, 1);
            y = node.y1 + nodePadding;
        });
        // If total exceeds height, compress
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
    // Compute link widths and y positions
    // Total value per node is used to compute widths proportionally
    links.forEach((link) => {
        const sourceTotal = link.source.value || 1;
        const sourceHeight = link.source.y1 - link.source.y0;
        link.width = (link.value / sourceTotal) * sourceHeight;
    });
    // Stack source links and target links to assign y0, y1
    nodes.forEach((node) => {
        let sy = node.y0;
        // Sort source links by target y position for cleaner layout
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
            const w = (link.value / targetTotal) * targetHeight;
            link.y1 = ty;
            link.width = Math.min(link.width, w) || link.width; // Use source width for path
            ty += w;
        });
    });
    return { nodes, links };
}
//# sourceMappingURL=flow.js.map