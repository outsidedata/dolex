/**
 * Waffle chart D3 renderer.
 * Composition chart: 10×10 grid of squares showing part-of-whole.
 * Follows preflight standards: HTML legend, category hover, auto-sizing, instant render.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, createLegend, formatValue, renderEmptyState, isAllZeros, DARK_BG, } from '../shared.js';
export function renderWaffle(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.color?.field;
    const valueField = config.valueField;
    const gridSize = config.gridSize || 10;
    const totalSquares = gridSize * gridSize;
    // Calculate squares per category
    const total = config.total || data.reduce((s, d) => s + (Number(d[valueField]) || 0), 0);
    const items = data.map((d) => ({
        category: d[categoryField],
        value: Number(d[valueField]) || 0,
        percentage: d._percentage ?? ((Number(d[valueField]) || 0) / total) * 100,
        squares: d._squares ?? Math.round(((Number(d[valueField]) || 0) / total) * totalSquares),
    }));
    // Ensure every non-zero category gets at least 1 cell (extreme-range guard)
    for (const item of items) {
        if (item.value > 0 && item.squares < 1) {
            item.squares = 1;
        }
    }
    // Ensure squares sum to gridSize²
    const sumSquares = items.reduce((s, item) => s + item.squares, 0);
    if (sumSquares !== totalSquares && items.length > 0) {
        items[0].squares += totalSquares - sumSquares;
    }
    const colorScale = buildColorScale(encoding.color, data);
    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;
    const showLegend = containerHeight > 200 && containerWidth > 250;
    // Flex column container: chart on top, legend below
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    let legendDiv = null;
    if (showLegend) {
        const legendItems = items.map(item => ({
            label: String(item.category),
            color: colorScale(item.category),
            extra: `${item.percentage.toFixed(1)}%`,
        }));
        legendDiv = createLegend(legendItems);
        container.appendChild(legendDiv);
    }
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        top: 40,
        left: 20,
        right: 20,
        bottom: 20,
    });
    // Remove default background — container handles it
    svg.style('background', 'none').style('border-radius', '0');
    const tooltip = createTooltip(container);
    // Check if all values are zero
    if (isAllZeros(data, valueField)) {
        renderEmptyState(g, dims);
        return;
    }
    // Auto-calculate square size to fit the available space
    const maxSquareFromWidth = (dims.innerWidth - (gridSize - 1) * 2) / gridSize;
    const maxSquareFromHeight = (dims.innerHeight - (gridSize - 1) * 2) / gridSize;
    const autoSquareSize = Math.max(4, Math.floor(Math.min(maxSquareFromWidth, maxSquareFromHeight)));
    const squareSize = config.squareSize ? Math.min(config.squareSize, autoSquareSize) : autoSquareSize;
    const gap = config.gap ?? 2;
    // Build the grid assignment
    const grid = [];
    let sqIndex = 0;
    items.forEach((item) => {
        for (let s = 0; s < item.squares; s++) {
            const row = Math.floor(sqIndex / gridSize);
            const col = sqIndex % gridSize;
            grid.push({ category: item.category, row, col });
            sqIndex++;
        }
    });
    // Center the grid in available space
    const gridPixelW = gridSize * squareSize + (gridSize - 1) * gap;
    const gridPixelH = gridSize * squareSize + (gridSize - 1) * gap;
    const offsetX = Math.max(0, (dims.innerWidth - gridPixelW) / 2);
    const offsetY = Math.max(0, (dims.innerHeight - gridPixelH) / 2);
    // Draw squares — pointer-events: none, hover handled by invisible targets
    g.selectAll('.waffle-square')
        .data(grid)
        .join('rect')
        .attr('class', 'waffle-square')
        .attr('x', (d) => offsetX + d.col * (squareSize + gap))
        .attr('y', (d) => offsetY + (gridSize - 1 - d.row) * (squareSize + gap))
        .attr('width', squareSize)
        .attr('height', squareSize)
        .attr('rx', Math.min(3, squareSize * 0.15))
        .attr('fill', (d) => colorScale(d.category))
        .attr('pointer-events', 'none');
    // Invisible hover targets per square — highlight full category on hover
    g.selectAll('.waffle-hover')
        .data(grid)
        .join('rect')
        .attr('class', 'waffle-hover')
        .attr('x', (d) => offsetX + d.col * (squareSize + gap))
        .attr('y', (d) => offsetY + (gridSize - 1 - d.row) * (squareSize + gap))
        .attr('width', squareSize)
        .attr('height', squareSize)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        // Dim all squares, highlight this category
        g.selectAll('.waffle-square')
            .attr('opacity', (sq) => sq.category === d.category ? 1 : 0.3);
        const item = items.find((i) => i.category === d.category);
        showTooltip(tooltip, `<strong>${d.category}</strong><br/>${formatValue(item?.value ?? 0)}<br/>${item?.percentage.toFixed(1)}%`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.waffle-square').attr('opacity', 1);
        hideTooltip(tooltip);
    });
}
//# sourceMappingURL=waffle.js.map