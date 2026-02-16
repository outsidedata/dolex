/**
 * Alluvial diagram D3 renderer.
 *
 * Renders multiple columns of stacked bars (one per stage/category)
 * with curved ribbons showing how quantities redistribute between
 * categories across stages. Like a multi-column Sankey.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, truncateLabel, renderEmptyState, isAllZeros, DEFAULT_PALETTE, DARK_BG, TEXT_COLOR, TEXT_MUTED, } from '../shared.js';
// ─── RENDERER ────────────────────────────────────────────────────────────────
export function renderAlluvial(container, spec) {
    const { config, encoding, data } = spec;
    const stageFields = config.stageFields || [];
    const valueField = config.valueField || 'value';
    const nodeWidth = config.nodeWidth ?? 20;
    const nodePadding = config.nodePadding ?? 10;
    const flowOpacity = config.flowOpacity ?? 0.4;
    const showLabels = config.showLabels !== false;
    const showValues = config.showValues === true;
    const colorBy = config.colorBy || 'source';
    if (stageFields.length < 2) {
        container.innerHTML =
            '<p style="color:#ef4444;padding:20px;">Alluvial requires at least 2 stage fields</p>';
        return;
    }
    // ── Adaptive margins: more left/right space for labels when not small
    const containerW = container.clientWidth || 800;
    const containerH = container.clientHeight || 500;
    const isSmall = containerW < 450 || containerH < 320;
    const labelMargin = isSmall ? 10 : 80;
    const { svg, g, dims } = createSvg(container, spec, {
        top: 40,
        left: labelMargin,
        right: labelMargin,
        bottom: isSmall ? 20 : 30,
    });
    const tooltip = createTooltip(container);
    // Check if all values are zero
    if (isAllZeros(data, valueField)) {
        renderEmptyState(g, dims);
        return;
    }
    // ── Build color scale via shared system (supports palettes, highlight, etc.)
    const allCategories = [];
    const catSet = new Set();
    for (const field of stageFields) {
        for (const row of data) {
            const cat = String(row[field]);
            if (!catSet.has(cat)) {
                catSet.add(cat);
                allCategories.push(cat);
            }
        }
    }
    // Build a synthetic data array for buildColorScale — it needs rows with the color field
    const colorField = encoding?.color?.field || stageFields[0];
    const syntheticColorData = allCategories.map(cat => ({ [colorField]: cat }));
    const colorScale = encoding?.color
        ? buildColorScale(encoding.color, syntheticColorData)
        : d3.scaleOrdinal().domain(allCategories).range(DEFAULT_PALETTE);
    // ── Build nodes per stage ──
    const stageNodes = [];
    for (let si = 0; si < stageFields.length; si++) {
        const field = stageFields[si];
        const categoryTotals = new Map();
        for (const row of data) {
            const cat = String(row[field]);
            const val = Number(row[valueField]) || 0;
            categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + val);
        }
        // Sort by value descending for stable layout
        const sorted = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
        const nodes = sorted.map(([category, value]) => ({
            stage: si,
            category,
            value,
            x0: 0,
            x1: 0,
            y0: 0,
            y1: 0,
        }));
        stageNodes.push(nodes);
    }
    // ── Position nodes ──
    const numStages = stageFields.length;
    const columnGap = numStages > 1 ? (dims.innerWidth - nodeWidth) / (numStages - 1) : 0;
    for (let si = 0; si < numStages; si++) {
        const nodes = stageNodes[si];
        const x0 = si * columnGap;
        const x1 = x0 + nodeWidth;
        const totalValue = nodes.reduce((s, n) => s + n.value, 0);
        const totalPadding = Math.max(0, (nodes.length - 1) * nodePadding);
        const availableHeight = dims.innerHeight - totalPadding;
        const scale = totalValue > 0 ? availableHeight / totalValue : 1;
        const MIN_NODE_HEIGHT = 3;
        let y = 0;
        for (const node of nodes) {
            node.x0 = x0;
            node.x1 = x1;
            node.y0 = y;
            node.y1 = y + Math.max(node.value * scale, MIN_NODE_HEIGHT);
            y = node.y1 + nodePadding;
        }
        // Compress if exceeding height
        const excess = y - nodePadding - dims.innerHeight;
        if (excess > 0 && nodes.length > 0) {
            const compressionFactor = dims.innerHeight / (y - nodePadding);
            let cy = 0;
            for (const node of nodes) {
                const h = (node.y1 - node.y0) * compressionFactor;
                node.y0 = cy;
                node.y1 = cy + h;
                cy += h + nodePadding * compressionFactor;
            }
        }
    }
    // ── Build flows between adjacent stages ──
    const allFlows = [];
    for (let si = 0; si < numStages - 1; si++) {
        const sourceField = stageFields[si];
        const targetField = stageFields[si + 1];
        // Aggregate flows between source and target categories
        const flowMap = new Map();
        for (const row of data) {
            const sCat = String(row[sourceField]);
            const tCat = String(row[targetField]);
            const val = Number(row[valueField]) || 0;
            const key = `${sCat}|||${tCat}`;
            flowMap.set(key, (flowMap.get(key) || 0) + val);
        }
        // Build a node lookup for this pair
        const sourceNodeMap = new Map();
        for (const n of stageNodes[si])
            sourceNodeMap.set(n.category, n);
        const targetNodeMap = new Map();
        for (const n of stageNodes[si + 1])
            targetNodeMap.set(n.category, n);
        // Create flow objects
        const stageFlows = [];
        for (const [key, value] of flowMap) {
            const [sCat, tCat] = key.split('|||');
            const sourceNode = sourceNodeMap.get(sCat);
            const targetNode = targetNodeMap.get(tCat);
            if (!sourceNode || !targetNode)
                continue;
            stageFlows.push({
                sourceStage: si,
                sourceCategory: sCat,
                targetCategory: tCat,
                value,
                sy0: 0,
                sy1: 0,
                ty0: 0,
                ty1: 0,
                sourceNode,
                targetNode,
            });
        }
        // Sort flows for consistent stacking: by source category order, then target
        stageFlows.sort((a, b) => {
            const sOrderA = stageNodes[si].indexOf(a.sourceNode);
            const sOrderB = stageNodes[si].indexOf(b.sourceNode);
            if (sOrderA !== sOrderB)
                return sOrderA - sOrderB;
            const tOrderA = stageNodes[si + 1].indexOf(a.targetNode);
            const tOrderB = stageNodes[si + 1].indexOf(b.targetNode);
            return tOrderA - tOrderB;
        });
        // Compute vertical positions within source nodes
        const sourceOffsets = new Map();
        for (const n of stageNodes[si])
            sourceOffsets.set(n.category, n.y0);
        const MIN_FLOW_HEIGHT = 2;
        for (const flow of stageFlows) {
            const sourceNode = flow.sourceNode;
            const nodeHeight = sourceNode.y1 - sourceNode.y0;
            const flowHeight = sourceNode.value > 0
                ? Math.max((flow.value / sourceNode.value) * nodeHeight, MIN_FLOW_HEIGHT)
                : 0;
            const offset = sourceOffsets.get(flow.sourceCategory) || sourceNode.y0;
            flow.sy0 = offset;
            flow.sy1 = offset + flowHeight;
            sourceOffsets.set(flow.sourceCategory, offset + flowHeight);
        }
        // Sort for target stacking: by target category order, then source
        const targetSorted = [...stageFlows].sort((a, b) => {
            const tOrderA = stageNodes[si + 1].indexOf(a.targetNode);
            const tOrderB = stageNodes[si + 1].indexOf(b.targetNode);
            if (tOrderA !== tOrderB)
                return tOrderA - tOrderB;
            const sOrderA = stageNodes[si].indexOf(a.sourceNode);
            const sOrderB = stageNodes[si].indexOf(b.sourceNode);
            return sOrderA - sOrderB;
        });
        // Compute vertical positions within target nodes
        const targetOffsets = new Map();
        for (const n of stageNodes[si + 1])
            targetOffsets.set(n.category, n.y0);
        for (const flow of targetSorted) {
            const targetNode = flow.targetNode;
            const nodeHeight = targetNode.y1 - targetNode.y0;
            const flowHeight = targetNode.value > 0
                ? Math.max((flow.value / targetNode.value) * nodeHeight, MIN_FLOW_HEIGHT)
                : 0;
            const offset = targetOffsets.get(flow.targetCategory) || targetNode.y0;
            flow.ty0 = offset;
            flow.ty1 = offset + flowHeight;
            targetOffsets.set(flow.targetCategory, offset + flowHeight);
        }
        allFlows.push(...stageFlows);
    }
    // ── Draw flows (ribbons) ──
    drawFlows(g, allFlows, colorScale, flowOpacity, colorBy, tooltip);
    // ── Draw nodes ──
    const flatNodes = stageNodes.flat();
    drawNodes(g, flatNodes, allFlows, colorScale, flowOpacity, tooltip);
    // ── Draw labels (skip in small mode) ──
    if (showLabels && !isSmall) {
        drawLabels(g, stageNodes, stageFields, showValues, numStages, dims);
    }
}
// ─── DRAWING HELPERS ─────────────────────────────────────────────────────────
function ribbonPath(flow) {
    const sx = flow.sourceNode.x1;
    const tx = flow.targetNode.x0;
    const mx = (sx + tx) / 2;
    return `
    M ${sx},${flow.sy0}
    C ${mx},${flow.sy0} ${mx},${flow.ty0} ${tx},${flow.ty0}
    L ${tx},${flow.ty1}
    C ${mx},${flow.ty1} ${mx},${flow.sy1} ${sx},${flow.sy1}
    Z
  `;
}
function drawFlows(g, flows, colorScale, flowOpacity, colorBy, tooltip) {
    g.selectAll('.alluvial-flow')
        .data(flows)
        .join('path')
        .attr('class', 'alluvial-flow')
        .attr('d', ribbonPath)
        .attr('fill', (d) => colorBy === 'target' ? colorScale(d.targetCategory) : colorScale(d.sourceCategory))
        .attr('opacity', flowOpacity)
        .attr('stroke', 'none')
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', Math.min(flowOpacity + 0.3, 0.9));
        showTooltip(tooltip, `<strong>${d.sourceCategory} → ${d.targetCategory}</strong><br/>Value: ${formatValue(d.value)}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', flowOpacity);
        hideTooltip(tooltip);
    });
}
function drawNodes(g, nodes, allFlows, colorScale, flowOpacity, tooltip) {
    g.selectAll('.alluvial-node')
        .data(nodes)
        .join('rect')
        .attr('class', 'alluvial-node')
        .attr('x', (d) => d.x0)
        .attr('y', (d) => d.y0)
        .attr('width', (d) => d.x1 - d.x0)
        .attr('height', (d) => Math.max(d.y1 - d.y0, 3))
        .attr('fill', (d) => colorScale(d.category))
        .attr('rx', 2)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 1)
        .on('mouseover', function (event, d) {
        // Highlight this node
        d3.select(this).attr('opacity', 0.8);
        // Dim unrelated flows, brighten connected ones
        g.selectAll('.alluvial-flow')
            .attr('opacity', (f) => {
            const connected = (f.sourceNode.stage === d.stage && f.sourceCategory === d.category) ||
                (f.targetNode.stage === d.stage && f.targetCategory === d.category);
            return connected ? Math.min(flowOpacity + 0.3, 0.9) : 0.06;
        });
        // Tooltip with inflow/outflow details
        const inflows = allFlows.filter(f => f.targetNode.stage === d.stage && f.targetCategory === d.category);
        const outflows = allFlows.filter(f => f.sourceNode.stage === d.stage && f.sourceCategory === d.category);
        const inflowTotal = inflows.reduce((s, f) => s + f.value, 0);
        const outflowTotal = outflows.reduce((s, f) => s + f.value, 0);
        let html = `<strong>${d.category}</strong><br/>Total: ${formatValue(d.value)}`;
        if (inflowTotal > 0)
            html += `<br/>Inflow: ${formatValue(inflowTotal)}`;
        if (outflowTotal > 0)
            html += `<br/>Outflow: ${formatValue(outflowTotal)}`;
        showTooltip(tooltip, html, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        // Reset all flows
        g.selectAll('.alluvial-flow').attr('opacity', flowOpacity);
        hideTooltip(tooltip);
    });
}
function drawLabels(g, stageNodes, stageFields, showValues, numStages, dims) {
    // Stage header labels — below the chart
    for (let si = 0; si < numStages; si++) {
        const nodes = stageNodes[si];
        if (nodes.length === 0)
            continue;
        const x = (nodes[0].x0 + nodes[0].x1) / 2;
        g.append('text')
            .attr('x', x)
            .attr('y', dims.innerHeight + 16)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(stageFields[si]);
    }
    // Node category labels
    const lastStage = numStages - 1;
    const flatNodes = stageNodes.flat();
    g.selectAll('.alluvial-label')
        .data(flatNodes)
        .join('text')
        .attr('class', 'alluvial-label')
        .attr('x', (d) => {
        // First stage: label on left; last stage: label on right
        // Middle stages: label on the side with more space
        if (d.stage === 0)
            return d.x0 - 6;
        if (d.stage === lastStage)
            return d.x1 + 6;
        // Middle stages: put label on right (flows connect on both sides)
        return d.x1 + 6;
    })
        .attr('y', (d) => (d.y0 + d.y1) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => (d.stage === 0 ? 'end' : 'start'))
        .attr('fill', TEXT_COLOR)
        .attr('font-size', '10px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => {
        if (d.y1 - d.y0 < 12)
            return '';
        const isRight = d.stage > 0;
        const availPx = isRight ? dims.innerWidth - d.x1 - 6 : d.x0 - 6;
        const maxChars = Math.min(18, Math.max(8, Math.floor(availPx / 6)));
        const label = truncateLabel(d.category, maxChars);
        if (showValues)
            return `${label} (${formatValue(d.value)})`;
        return label;
    });
}
//# sourceMappingURL=alluvial.js.map