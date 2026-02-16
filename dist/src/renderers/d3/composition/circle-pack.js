/**
 * Circle Pack D3 renderer — SVG-based nested circles.
 *
 * Uses d3.pack() for layout, SVG circles for geometry, and centered
 * text labels with contrastText() for readability on any fill color.
 */
import { buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, contrastText, contrastTextMuted, DARK_BG, TEXT_COLOR, truncateTitle, } from '../shared.js';
export function renderCirclePack(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.color?.field || encoding.label?.field;
    const valueField = config.valueField || encoding.size?.field;
    const parentField = config.parentField || null;
    const padding = config.padding ?? 3;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const titleHeight = spec.title ? 36 : 0;
    const contentPadding = 8;
    // Pack layout needs a square-ish area; use the smaller dimension
    const availableWidth = width - contentPadding * 2;
    const availableHeight = height - titleHeight - contentPadding * 2;
    const packSize = Math.min(availableWidth, availableHeight);
    const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', DARK_BG)
        .style('border-radius', '8px');
    // Title
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
    // Center the pack layout in the available space
    const offsetX = (availableWidth - packSize) / 2 + contentPadding;
    const offsetY = titleHeight + (availableHeight - packSize) / 2 + contentPadding;
    const g = svg.append('g').attr('transform', `translate(${offsetX},${offsetY})`);
    const tooltip = createTooltip(container);
    // Build hierarchy
    const root = buildHierarchy(data, categoryField, valueField, parentField, config);
    // Guard: if total value is 0, assign equal weights so pack layout works
    if (root.value === 0) {
        root.each((node) => {
            if (!node.children)
                node.value = 1;
        });
        root.sum((d) => d.children ? 0 : 1);
    }
    // Apply pack layout
    const packLayout = d3
        .pack()
        .size([packSize, packSize])
        .padding(padding);
    packLayout(root);
    const colorScale = buildColorScale(encoding.color, data);
    const isQuantitativeColor = encoding.color?.type === 'quantitative';
    const colorField = encoding.color?.field;
    // Draw leaf circles
    const leaves = root.leaves();
    // Draw circles
    const circles = g
        .selectAll('.pack-circle')
        .data(leaves)
        .join('circle')
        .attr('class', 'pack-circle')
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', (d) => Math.max(0, d.r))
        .attr('fill', (d) => {
        if (isQuantitativeColor) {
            return colorScale(Number(d.data._data?.[colorField] ?? d.value));
        }
        return parentField && d.parent?.data?.name && d.parent.data.name !== 'root'
            ? colorScale(d.parent.data.name)
            : colorScale(d.data.name);
    })
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 1)
        .attr('cursor', 'default');
    // Hover interactions
    circles
        .on('mouseover', function (event, d) {
        d3.select(this)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2)
            .style('filter', 'brightness(1.15)');
        const parentName = parentField && d.parent?.data?.name && d.parent.data.name !== 'root'
            ? d.parent.data.name + ' > '
            : '';
        showTooltip(tooltip, `<strong>${parentName}${d.data.name}</strong><br/>${valueField}: ${formatValue(d.value)}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        d3.select(this)
            .attr('stroke', DARK_BG)
            .attr('stroke-width', 1)
            .style('filter', null);
        hideTooltip(tooltip);
    });
    // Labels — only on circles large enough
    if (config.showLabels !== false) {
        leaves.forEach((leaf, i) => {
            if (leaf.r < 15)
                return; // Too small for any label
            const fillColor = isQuantitativeColor
                ? colorScale(Number(leaf.data._data?.[colorField] ?? leaf.value))
                : parentField && leaf.parent?.data?.name && leaf.parent.data.name !== 'root'
                    ? colorScale(leaf.parent.data.name)
                    : colorScale(leaf.data.name);
            const labelColor = contrastText(fillColor);
            const valueColor = contrastTextMuted(fillColor);
            const labelGroup = g
                .append('g')
                .attr('pointer-events', 'none');
            // Category name
            const fontSize = leaf.r > 40 ? 12 : leaf.r > 25 ? 10 : 8;
            const name = String(leaf.data.name);
            const maxChars = Math.max(3, Math.floor(leaf.r / (fontSize * 0.35)));
            const truncated = name.length > maxChars ? name.slice(0, maxChars - 1) + '\u2026' : name;
            const showValue = leaf.r >= 25 && config.showValues !== false;
            const labelY = showValue ? leaf.y - fontSize * 0.4 : leaf.y;
            labelGroup
                .append('text')
                .attr('x', leaf.x)
                .attr('y', labelY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('fill', labelColor)
                .attr('font-size', `${fontSize}px`)
                .attr('font-weight', '700')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(truncated);
            // Value (beneath label)
            if (showValue) {
                const valueFontSize = Math.max(8, fontSize - 2);
                labelGroup
                    .append('text')
                    .attr('x', leaf.x)
                    .attr('y', leaf.y + fontSize * 0.6)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'central')
                    .attr('fill', valueColor)
                    .attr('font-size', `${valueFontSize}px`)
                    .attr('font-weight', '400')
                    .attr('font-family', 'Inter, system-ui, sans-serif')
                    .text(formatValue(leaf.value));
            }
        });
    }
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function buildHierarchy(data, categoryField, valueField, parentField, config) {
    // Compute min-visible threshold: 2% of max ensures extreme-range items stay visible
    const allVals = data.map((d) => Number(d[valueField]) || 0).filter((v) => v > 0);
    const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
    const minVisible = maxVal * 0.02;
    const clampVal = (v) => (v > 0 && v < minVisible ? minVisible : v);
    if (parentField) {
        const parents = [...new Set(data.map((d) => d[parentField]))];
        const hierarchy = {
            name: 'root',
            children: parents.map((p) => ({
                name: p,
                children: data
                    .filter((d) => d[parentField] === p)
                    .map((d) => ({
                    name: d[categoryField] || d[config.childField] || d[parentField],
                    value: clampVal(Number(d[valueField]) || 0),
                    _data: d,
                })),
            })),
        };
        return d3.hierarchy(hierarchy).sum((d) => d.value).sort((a, b) => b.value - a.value);
    }
    const hierarchy = {
        name: 'root',
        children: data.map((d) => ({
            name: d[categoryField],
            value: clampVal(Number(d[valueField]) || 0),
            _data: d,
        })),
    };
    return d3.hierarchy(hierarchy).sum((d) => d.value).sort((a, b) => b.value - a.value);
}
//# sourceMappingURL=circle-pack.js.map