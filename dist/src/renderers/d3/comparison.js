/**
 * Comparison renderers — bar, diverging-bar, slope-chart.
 */
import { createSvg, buildColorScale, drawXAxis, drawYAxis, createTooltip, showTooltip, hideTooltip, formatValue, TEXT_COLOR, TEXT_MUTED, } from './shared.js';
// ─── BAR CHART ───────────────────────────────────────────────────────────────
export function renderBar(container, spec) {
    const { config, encoding, data } = spec;
    const isHorizontal = config.orientation === 'horizontal';
    // Sort data if requested
    let sortedData = [...data];
    if (config.sortBy === 'value' && encoding.y) {
        const yField = encoding.y.field;
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        sortedData.sort((a, b) => order * (Number(a[yField]) - Number(b[yField])));
    }
    const marginOverrides = isHorizontal
        ? { left: 120, bottom: 40 }
        : { bottom: 60, left: 70 };
    const { svg, g, dims } = createSvg(container, spec, marginOverrides);
    const tooltip = createTooltip(container);
    if (isHorizontal) {
        // Horizontal bar: x is quantitative, y is nominal
        const yField = encoding.x.field; // category on y
        const xField = encoding.y.field; // value on x
        const categories = sortedData.map((d) => d[yField]);
        const yScale = d3.scaleBand().domain(categories).range([0, dims.innerHeight]).padding(0.2);
        const maxVal = d3.max(sortedData, (d) => Number(d[xField]));
        const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, dims.innerWidth]).nice();
        const colorScale = buildColorScale(encoding.color, sortedData);
        drawXAxis(g, xScale, dims.innerHeight, encoding.y?.title);
        drawYAxis(g, yScale, dims.innerWidth);
        g.selectAll('.bar')
            .data(sortedData)
            .join('rect')
            .attr('class', 'bar')
            .attr('y', (d) => yScale(d[yField]))
            .attr('x', 0)
            .attr('height', yScale.bandwidth())
            .attr('width', 0)
            .attr('fill', (d) => colorScale(d[encoding.color?.field || yField]))
            .attr('rx', 3)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 0.8);
            showTooltip(tooltip, `<strong>${d[yField]}</strong><br/>${xField}: ${formatValue(Number(d[xField]))}`, event);
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
            .attr('width', (d) => xScale(Number(d[xField])));
    }
    else {
        // Vertical bar: x is nominal, y is quantitative
        const xField = encoding.x.field;
        const yField = encoding.y.field;
        const categories = sortedData.map((d) => d[xField]);
        const xScale = d3.scaleBand().domain(categories).range([0, dims.innerWidth]).padding(0.2);
        const maxVal = d3.max(sortedData, (d) => Number(d[yField]));
        const yScale = d3
            .scaleLinear()
            .domain([0, maxVal])
            .range([dims.innerHeight, 0])
            .nice();
        const colorScale = buildColorScale(encoding.color, sortedData);
        drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title, true);
        drawYAxis(g, yScale, dims.innerWidth, encoding.y?.title);
        // Rotate x labels if many categories
        if (categories.length > 6) {
            g.selectAll('.x-axis .tick text')
                .attr('transform', 'rotate(-35)')
                .attr('text-anchor', 'end')
                .attr('dx', '-0.5em')
                .attr('dy', '0.2em');
        }
        g.selectAll('.bar')
            .data(sortedData)
            .join('rect')
            .attr('class', 'bar')
            .attr('x', (d) => xScale(d[xField]))
            .attr('y', dims.innerHeight)
            .attr('width', xScale.bandwidth())
            .attr('height', 0)
            .attr('fill', (d) => colorScale(d[encoding.color?.field || xField]))
            .attr('rx', 3)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 0.8);
            showTooltip(tooltip, `<strong>${d[xField]}</strong><br/>${yField}: ${formatValue(Number(d[yField]))}`, event);
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
            .attr('y', (d) => yScale(Number(d[yField])))
            .attr('height', (d) => dims.innerHeight - yScale(Number(d[yField])));
        // Value labels on bars
        if (config.showLabels) {
            g.selectAll('.bar-label')
                .data(sortedData)
                .join('text')
                .attr('class', 'bar-label')
                .attr('x', (d) => xScale(d[xField]) + xScale.bandwidth() / 2)
                .attr('y', (d) => yScale(Number(d[yField])) - 6)
                .attr('text-anchor', 'middle')
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '10px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text((d) => formatValue(Number(d[yField])));
        }
    }
}
// ─── DIVERGING BAR ───────────────────────────────────────────────────────────
export function renderDivergingBar(container, spec) {
    const { encoding, data } = spec;
    const xField = encoding.x?.field || Object.keys(data[0])[0];
    const yField = encoding.y?.field || Object.keys(data[0])[1];
    const { svg, g, dims } = createSvg(container, spec, { left: 120 });
    const tooltip = createTooltip(container);
    const categories = data.map((d) => d[xField]);
    const yScale = d3.scaleBand().domain(categories).range([0, dims.innerHeight]).padding(0.2);
    const values = data.map((d) => Number(d[yField]));
    const maxAbs = Math.max(Math.abs(d3.min(values)), Math.abs(d3.max(values)));
    const xScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, dims.innerWidth]).nice();
    const midX = xScale(0);
    drawXAxis(g, xScale, dims.innerHeight, encoding.y?.title);
    drawYAxis(g, yScale, dims.innerWidth);
    // Center line
    g.append('line')
        .attr('x1', midX)
        .attr('y1', 0)
        .attr('x2', midX)
        .attr('y2', dims.innerHeight)
        .attr('stroke', '#4b5563')
        .attr('stroke-width', 1);
    g.selectAll('.bar')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('y', (d) => yScale(d[xField]))
        .attr('height', yScale.bandwidth())
        .attr('x', (d) => {
        const val = Number(d[yField]);
        return val >= 0 ? midX : xScale(val);
    })
        .attr('width', (d) => Math.abs(xScale(Number(d[yField])) - midX))
        .attr('fill', (d) => (Number(d[yField]) >= 0 ? '#10b981' : '#ef4444'))
        .attr('rx', 3)
        .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        showTooltip(tooltip, `<strong>${d[xField]}</strong><br/>${yField}: ${Number(d[yField]) >= 0 ? '+' : ''}${formatValue(Number(d[yField]))}`, event);
    })
        .on('mousemove', (event) => {
        tooltip.style.left = event.clientX + 12 + 'px';
        tooltip.style.top = event.clientY - 12 + 'px';
    })
        .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        hideTooltip(tooltip);
    });
}
// ─── SLOPE CHART ─────────────────────────────────────────────────────────────
export function renderSlopeChart(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.color?.field;
    const valueField = config.valueField || encoding.y?.field;
    const periodField = config.periodField || encoding.x?.field;
    const periods = config.periods || [...new Set(data.map((d) => d[periodField]))].slice(0, 2);
    const { svg, g, dims } = createSvg(container, spec, { left: 140, right: 140 });
    const tooltip = createTooltip(container);
    // Group data by category
    const categories = [...new Set(data.map((d) => d[categoryField]))];
    const grouped = {};
    categories.forEach((cat) => {
        grouped[cat] = {};
        data
            .filter((d) => d[categoryField] === cat)
            .forEach((d) => {
            grouped[cat][d[periodField]] = Number(d[valueField]);
        });
    });
    // Y scale based on all values
    const allValues = data.map((d) => Number(d[valueField]));
    const yScale = d3
        .scaleLinear()
        .domain([d3.min(allValues) * 0.9, d3.max(allValues) * 1.1])
        .range([dims.innerHeight, 0])
        .nice();
    // X scale: just two points
    const xScale = d3.scalePoint().domain(periods).range([0, dims.innerWidth]).padding(0);
    const colorScale = buildColorScale(encoding.color, data);
    // Vertical lines at each period
    periods.forEach((period) => {
        g.append('line')
            .attr('x1', xScale(period))
            .attr('y1', 0)
            .attr('x2', xScale(period))
            .attr('y2', dims.innerHeight)
            .attr('stroke', '#2d3041')
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
    // Draw slope lines
    categories.forEach((cat) => {
        const catStr = cat;
        const vals = grouped[catStr];
        if (vals[periods[0]] == null || vals[periods[1]] == null)
            return;
        const y1 = yScale(vals[periods[0]]);
        const y2 = yScale(vals[periods[1]]);
        const color = colorScale(cat);
        // Line
        g.append('line')
            .attr('x1', xScale(periods[0]))
            .attr('y1', y1)
            .attr('x2', xScale(periods[1]))
            .attr('y2', y2)
            .attr('stroke', color)
            .attr('stroke-width', 2.5)
            .attr('opacity', 0.8)
            .on('mouseover', function (event) {
            d3.select(this).attr('stroke-width', 4).attr('opacity', 1);
            const change = vals[periods[1]] - vals[periods[0]];
            const pctChange = ((change / vals[periods[0]]) * 100).toFixed(1);
            showTooltip(tooltip, `<strong>${catStr}</strong><br/>${periods[0]}: ${formatValue(vals[periods[0]])}<br/>${periods[1]}: ${formatValue(vals[periods[1]])}<br/>Change: ${change >= 0 ? '+' : ''}${pctChange}%`, event);
        })
            .on('mousemove', (event) => {
            tooltip.style.left = event.clientX + 12 + 'px';
            tooltip.style.top = event.clientY - 12 + 'px';
        })
            .on('mouseout', function () {
            d3.select(this).attr('stroke-width', 2.5).attr('opacity', 0.8);
            hideTooltip(tooltip);
        });
        // Dots at endpoints
        [periods[0], periods[1]].forEach((period) => {
            g.append('circle')
                .attr('cx', xScale(period))
                .attr('cy', yScale(vals[period]))
                .attr('r', 5)
                .attr('fill', color)
                .attr('stroke', '#0f1117')
                .attr('stroke-width', 2);
        });
        // Labels at left and right
        if (config.showLabels !== false) {
            g.append('text')
                .attr('x', xScale(periods[0]) - 10)
                .attr('y', y1 + 4)
                .attr('text-anchor', 'end')
                .attr('fill', color)
                .attr('font-size', '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(`${catStr} (${formatValue(vals[periods[0]])})`);
            g.append('text')
                .attr('x', xScale(periods[1]) + 10)
                .attr('y', y2 + 4)
                .attr('text-anchor', 'start')
                .attr('fill', color)
                .attr('font-size', '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(formatValue(vals[periods[1]]));
        }
    });
}
//# sourceMappingURL=comparison.js.map