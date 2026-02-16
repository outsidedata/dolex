/**
 * Composition renderers — stacked-bar, waffle, treemap.
 */
import { createSvg, buildColorScale, drawXAxis, drawYAxis, drawLegend, createTooltip, showTooltip, hideTooltip, formatValue, TEXT_COLOR, TEXT_MUTED, } from './shared.js';
// ─── STACKED BAR ─────────────────────────────────────────────────────────────
export function renderStackedBar(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.x?.field;
    const seriesField = config.seriesField || encoding.color?.field;
    const valueField = config.valueField || encoding.y?.field;
    const isNormalized = config.normalized || false;
    const { svg, g, dims } = createSvg(container, spec, { bottom: 60, right: 140 });
    const tooltip = createTooltip(container);
    // Get unique categories and series
    const categories = [...new Set(data.map((d) => d[categoryField]))];
    const series = [...new Set(data.map((d) => d[seriesField]))];
    // Build pivot table: category -> series -> value
    const pivoted = {};
    categories.forEach((cat) => {
        pivoted[cat] = {};
        series.forEach((s) => {
            const row = data.find((d) => d[categoryField] === cat && d[seriesField] === s);
            pivoted[cat][s] = row ? Number(row[valueField]) || 0 : 0;
        });
    });
    // Compute stacked data
    const stackData = categories.map((cat) => {
        const entry = { _category: cat };
        const total = series.reduce((sum, s) => sum + (pivoted[cat][s] || 0), 0);
        series.forEach((s) => {
            const val = pivoted[cat][s] || 0;
            entry[s] = isNormalized && total > 0 ? (val / total) * 100 : val;
        });
        entry._total = isNormalized ? 100 : total;
        return entry;
    });
    const stack = d3.stack().keys(series);
    const stacked = stack(stackData);
    // Scales
    const xScale = d3.scaleBand().domain(categories).range([0, dims.innerWidth]).padding(0.2);
    const maxY = isNormalized
        ? 100
        : d3.max(stackData, (d) => d._total);
    const yScale = d3
        .scaleLinear()
        .domain([0, maxY])
        .range([dims.innerHeight, 0])
        .nice();
    const colorScale = buildColorScale(encoding.color, data);
    drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title, true);
    drawYAxis(g, yScale, dims.innerWidth, isNormalized ? 'Percentage (%)' : encoding.y?.title);
    // Rotate x labels
    if (categories.length > 6) {
        g.selectAll('.x-axis .tick text')
            .attr('transform', 'rotate(-35)')
            .attr('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.2em');
    }
    // Draw stacked bars
    g.selectAll('.series')
        .data(stacked)
        .join('g')
        .attr('class', 'series')
        .attr('fill', (d) => colorScale(d.key))
        .selectAll('rect')
        .data((d) => d.map((v) => ({ ...v, key: d.key })))
        .join('rect')
        .attr('x', (d) => xScale(d.data._category))
        .attr('y', dims.innerHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('rx', 1)
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        const val = d[1] - d[0];
        showTooltip(tooltip, `<strong>${d.data._category}</strong><br/>${d.key}: ${isNormalized ? val.toFixed(1) + '%' : formatValue(val)}`, event);
    })
        .on('mousemove', (event) => {
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 12 + 'px';
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        hideTooltip(tooltip);
    })
        .transition()
        .duration(600)
        .attr('y', (d) => yScale(d[1]))
        .attr('height', (d) => yScale(d[0]) - yScale(d[1]));
    // Total labels on top
    if (config.showTotal && !isNormalized) {
        g.selectAll('.total-label')
            .data(stackData)
            .join('text')
            .attr('class', 'total-label')
            .attr('x', (d) => xScale(d._category) + xScale.bandwidth() / 2)
            .attr('y', (d) => yScale(d._total) - 6)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '10px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text((d) => formatValue(d._total));
    }
    drawLegend(svg, colorScale, dims);
}
// ─── WAFFLE CHART ────────────────────────────────────────────────────────────
export function renderWaffle(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.color?.field;
    const valueField = config.valueField;
    const gridSize = config.gridSize || 10;
    const squareSize = config.squareSize || 20;
    const gap = config.gap ?? 2;
    const { svg, g, dims } = createSvg(container, spec, { top: 50, left: 30, right: 200 });
    const tooltip = createTooltip(container);
    // Calculate squares per category
    const total = config.total || data.reduce((s, d) => s + (Number(d[valueField]) || 0), 0);
    const items = data.map((d) => ({
        category: d[categoryField],
        value: Number(d[valueField]) || 0,
        percentage: d._percentage ?? ((Number(d[valueField]) || 0) / total) * 100,
        squares: d._squares ?? Math.round(((Number(d[valueField]) || 0) / total) * 100),
    }));
    // Ensure squares sum to gridSize^2
    const totalSquares = items.reduce((s, item) => s + item.squares, 0);
    const targetTotal = gridSize * gridSize;
    if (totalSquares !== targetTotal && items.length > 0) {
        items[0].squares += targetTotal - totalSquares;
    }
    const colorScale = buildColorScale(encoding.color, data);
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
    // Center the grid
    const gridPixelW = gridSize * (squareSize + gap);
    const gridPixelH = gridSize * (squareSize + gap);
    const offsetX = Math.max(0, (dims.innerWidth - 160 - gridPixelW) / 2);
    const offsetY = Math.max(0, (dims.innerHeight - gridPixelH) / 2);
    g.selectAll('.waffle-square')
        .data(grid)
        .join('rect')
        .attr('class', 'waffle-square')
        .attr('x', (d) => offsetX + d.col * (squareSize + gap))
        .attr('y', (d) => offsetY + (gridSize - 1 - d.row) * (squareSize + gap))
        .attr('width', squareSize)
        .attr('height', squareSize)
        .attr('rx', 3)
        .attr('fill', (d) => colorScale(d.category))
        .attr('opacity', 0)
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 1.5);
        const item = items.find((i) => i.category === d.category);
        showTooltip(tooltip, `<strong>${d.category}</strong><br/>${valueField}: ${formatValue(item?.value ?? 0)}<br/>${item?.percentage.toFixed(1)}%`, event);
    })
        .on('mousemove', (event) => {
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 12 + 'px';
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.9).attr('stroke', 'none');
        hideTooltip(tooltip);
    })
        .transition()
        .duration(30)
        .delay((_d, i) => i * 8)
        .attr('opacity', 0.9);
    // Legend on the right
    const legendX = offsetX + gridPixelW + 24;
    items.forEach((item, i) => {
        const ly = offsetY + i * 28;
        g.append('rect')
            .attr('x', legendX)
            .attr('y', ly)
            .attr('width', 14)
            .attr('height', 14)
            .attr('rx', 3)
            .attr('fill', colorScale(item.category));
        g.append('text')
            .attr('x', legendX + 22)
            .attr('y', ly + 11)
            .attr('fill', TEXT_COLOR)
            .attr('font-size', '12px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(`${item.category}`);
        if (config.showPercentages) {
            g.append('text')
                .attr('x', legendX + 22)
                .attr('y', ly + 24)
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '10px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(`${item.percentage.toFixed(1)}% (${formatValue(item.value)})`);
        }
    });
}
// ─── TREEMAP ─────────────────────────────────────────────────────────────────
export function renderTreemap(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.color?.field || encoding.label?.field;
    const valueField = config.valueField || encoding.size?.field;
    const parentField = config.parentField || null;
    const padding = config.padding ?? 2;
    const { svg, g, dims } = createSvg(container, spec, { top: 40, left: 10, right: 10, bottom: 10 });
    const tooltip = createTooltip(container);
    // Build hierarchy
    let root;
    if (parentField) {
        // Hierarchical data: parent -> children
        const parents = [...new Set(data.map((d) => d[parentField]))];
        const hierarchy = {
            name: 'root',
            children: parents.map((p) => ({
                name: p,
                children: data
                    .filter((d) => d[parentField] === p)
                    .map((d) => ({
                    name: d[categoryField] || d[config.childField] || d[parentField],
                    value: Number(d[valueField]) || 0,
                    _data: d,
                })),
            })),
        };
        root = d3.hierarchy(hierarchy).sum((d) => d.value);
    }
    else {
        // Flat data: just categories with values
        const hierarchy = {
            name: 'root',
            children: data.map((d) => ({
                name: d[categoryField],
                value: Number(d[valueField]) || 0,
                _data: d,
            })),
        };
        root = d3.hierarchy(hierarchy).sum((d) => d.value);
    }
    // Apply treemap layout
    const treemapLayout = d3
        .treemap()
        .size([dims.innerWidth, dims.innerHeight])
        .padding(padding)
        .round(true);
    treemapLayout(root);
    const colorScale = buildColorScale(encoding.color, data);
    // Draw leaf nodes
    const leaves = root.leaves();
    const nodes = g
        .selectAll('.treemap-node')
        .data(leaves)
        .join('g')
        .attr('class', 'treemap-node')
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`);
    nodes
        .append('rect')
        .attr('width', (d) => Math.max(d.x1 - d.x0, 0))
        .attr('height', (d) => Math.max(d.y1 - d.y0, 0))
        .attr('rx', 3)
        .attr('fill', (d) => {
        // Color by parent if hierarchical, else by name
        if (parentField && d.parent?.data?.name) {
            return colorScale(d.parent.data.name);
        }
        return colorScale(d.data.name);
    })
        .attr('opacity', 0.85)
        .attr('stroke', '#0f1117')
        .attr('stroke-width', config.borderWidth ?? 1)
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 2);
        const parentName = parentField && d.parent?.data?.name ? d.parent.data.name + ' > ' : '';
        showTooltip(tooltip, `<strong>${parentName}${d.data.name}</strong><br/>${valueField}: ${formatValue(d.value)}`, event);
    })
        .on('mousemove', (event) => {
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 12 + 'px';
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.85).attr('stroke', '#0f1117').attr('stroke-width', config.borderWidth ?? 1);
        hideTooltip(tooltip);
    });
    // Labels
    if (config.showLabels) {
        nodes
            .append('text')
            .attr('x', 6)
            .attr('y', 16)
            .attr('fill', '#fff')
            .attr('font-size', (d) => {
            const w = d.x1 - d.x0;
            return w > 80 ? '11px' : w > 50 ? '9px' : '0px';
        })
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text((d) => {
            const w = d.x1 - d.x0;
            const name = String(d.data.name);
            const maxChars = Math.floor(w / 7);
            return name.length > maxChars ? name.slice(0, maxChars - 1) + '...' : name;
        });
        // Value labels
        if (config.showValues) {
            nodes
                .append('text')
                .attr('x', 6)
                .attr('y', 30)
                .attr('fill', 'rgba(255,255,255,0.7)')
                .attr('font-size', (d) => {
                const w = d.x1 - d.x0;
                return w > 60 ? '10px' : '0px';
            })
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text((d) => formatValue(d.value));
        }
    }
}
//# sourceMappingURL=composition.js.map