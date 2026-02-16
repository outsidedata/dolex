/**
 * Lollipop chart D3 renderer — dots on sticks for clean ranking.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, renderEmptyState, isAllZeros, truncateLabel, calculateLeftMargin, getAdaptiveTickCount, addSortControls, styleAxis, shouldRotateLabels, calculateBottomMargin, contrastText, } from '../shared.js';
export function renderLollipop(container, spec) {
    const { config, encoding, data } = spec;
    const isHorizontal = config.orientation !== 'vertical';
    const categoryField = config.categoryField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    if (!categoryField || !valueField)
        return;
    let sortedData = [...data];
    if (config.sortBy === 'value' || (config.sorted && !config.sortBy)) {
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        sortedData.sort((a, b) => order * (Number(a[valueField]) - Number(b[valueField])));
    }
    else if (config.sortBy === 'category') {
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        sortedData.sort((a, b) => {
            const aVal = String(a[categoryField]);
            const bVal = String(b[categoryField]);
            return order * aVal.localeCompare(bVal, undefined, { sensitivity: 'base', numeric: true });
        });
    }
    const dotRadius = config.dotRadius ?? 14;
    let marginOverrides;
    if (isHorizontal) {
        const labels = sortedData.map((d) => String(d[categoryField]));
        const leftMargin = calculateLeftMargin(labels);
        marginOverrides = { left: leftMargin, bottom: 40, right: 40 };
    }
    else {
        const labels = sortedData.map((d) => String(d[categoryField]));
        const containerWidth = container.clientWidth || 800;
        const estimatedSpacing = (containerWidth - 100) / labels.length;
        const willRotate = shouldRotateLabels(labels, estimatedSpacing);
        const bottomMargin = calculateBottomMargin(labels, willRotate);
        marginOverrides = { bottom: bottomMargin, left: 70, right: 30 };
    }
    const { svg, g, dims } = createSvg(container, spec, marginOverrides);
    const tooltip = createTooltip(container);
    // Check if all values are zero
    if (isAllZeros(data, valueField)) {
        renderEmptyState(g, dims);
        return;
    }
    if (isHorizontal) {
        renderHorizontal(g, sortedData, data, encoding, config, dims, tooltip, categoryField, valueField, dotRadius);
    }
    else {
        renderVertical(g, sortedData, data, encoding, config, dims, tooltip, categoryField, valueField, dotRadius);
    }
    const hasCategoricalLabels = sortedData.some((d) => {
        const value = d[categoryField];
        return typeof value === 'string' && isNaN(Number(value));
    });
    if (hasCategoricalLabels) {
        addSortControls(svg, container, spec, dims, renderLollipop);
    }
}
function renderHorizontal(g, data, originalData, encoding, config, dims, tooltip, categoryField, valueField, dotRadius) {
    const categories = data.map((d) => String(d[categoryField]));
    const yScale = d3
        .scalePoint()
        .domain(categories)
        .range([0, dims.innerHeight])
        .padding(0.5);
    const values = data.map((d) => Number(d[valueField]));
    const minVal = Math.min(0, d3.min(values));
    const maxVal = Math.max(0, d3.max(values));
    const xScale = d3
        .scaleLinear()
        .domain([minVal, maxVal])
        .range([0, dims.innerWidth])
        .nice();
    const colorScale = buildColorScale(encoding.color, originalData, valueField);
    const baselineX = xScale(0);
    const spacing = categories.length > 1 ? yScale.step() : dims.innerHeight;
    const r = Math.min(dotRadius, spacing / 2 - 1);
    const xTickCount = getAdaptiveTickCount(dims.innerWidth);
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .ticks(xTickCount)
        .tickSize(-dims.innerHeight)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(xAxis);
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3
        .axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat((d) => truncateLabel(d, 25)));
    styleAxis(yAxis);
    g.selectAll('.lollipop-hover')
        .data(data)
        .join('rect')
        .attr('class', 'lollipop-hover')
        .attr('x', 0)
        .attr('y', (d) => yScale(String(d[categoryField])) - spacing / 2)
        .attr('width', dims.innerWidth)
        .attr('height', spacing)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        const cat = String(d[categoryField]);
        const hoverSize = r * 1.3;
        g.selectAll('.lollipop-dot')
            .attr('opacity', (dd) => String(dd[categoryField]) === cat ? 1 : 0.25);
        g.selectAll('.lollipop-dot')
            .filter((dd) => String(dd[categoryField]) === cat)
            .attr('width', hoverSize * 2)
            .attr('height', hoverSize * 2)
            .attr('x', (dd) => xScale(Number(dd[valueField])) - hoverSize)
            .attr('y', (dd) => yScale(String(dd[categoryField])) - hoverSize);
        g.selectAll('.lollipop-stem')
            .attr('opacity', (dd) => String(dd[categoryField]) === cat ? 1 : 0.25);
        showTooltip(tooltip, `<strong>${d[categoryField]}</strong><br/>${valueField}: ${formatValue(Number(d[valueField]))}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.lollipop-dot')
            .attr('opacity', 1)
            .attr('width', r * 2)
            .attr('height', r * 2)
            .attr('x', (dd) => xScale(Number(dd[valueField])) - r)
            .attr('y', (dd) => yScale(String(dd[categoryField])) - r);
        g.selectAll('.lollipop-stem').attr('opacity', 1);
        hideTooltip(tooltip);
    });
    g.selectAll('.lollipop-stem')
        .data(data)
        .join('line')
        .attr('class', 'lollipop-stem')
        .attr('x1', baselineX)
        .attr('x2', (d) => {
        const val = Number(d[valueField]);
        return xScale(val) + (val >= 0 ? -r : r);
    })
        .attr('y1', (d) => yScale(String(d[categoryField])))
        .attr('y2', (d) => yScale(String(d[categoryField])))
        .attr('stroke', (d) => colorScale(d[encoding.color?.field || categoryField]))
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    g.selectAll('.lollipop-dot')
        .data(data)
        .join('rect')
        .attr('class', 'lollipop-dot')
        .attr('x', (d) => xScale(Number(d[valueField])) - r)
        .attr('y', (d) => yScale(String(d[categoryField])) - r)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('rx', 2)
        .attr('fill', (d) => colorScale(d[encoding.color?.field || categoryField]))
        .attr('stroke', '#0f1117')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');
    if (r >= 12) {
        g.selectAll('.lollipop-label')
            .data(data)
            .join('text')
            .attr('class', 'lollipop-label')
            .attr('x', (d) => xScale(Number(d[valueField])))
            .attr('y', (d) => yScale(String(d[categoryField])))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', (d) => contrastText(colorScale(d[encoding.color?.field || categoryField])))
            .attr('font-size', `${Math.min(10, r - 3)}px`)
            .attr('font-weight', '600')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text((d) => {
            const dotX = xScale(Number(d[valueField]));
            if (dotX < r + 5)
                return '';
            return formatValue(Number(d[valueField]));
        });
    }
}
function renderVertical(g, data, originalData, encoding, config, dims, tooltip, categoryField, valueField, dotRadius) {
    const categories = data.map((d) => String(d[categoryField]));
    const xScale = d3
        .scalePoint()
        .domain(categories)
        .range([0, dims.innerWidth])
        .padding(0.5);
    const values = data.map((d) => Number(d[valueField]));
    const minVal = Math.min(0, d3.min(values));
    const maxVal = Math.max(0, d3.max(values));
    const yScale = d3
        .scaleLinear()
        .domain([minVal, maxVal])
        .range([dims.innerHeight, 0])
        .nice();
    const colorScale = buildColorScale(encoding.color, originalData, valueField);
    const baselineY = yScale(0);
    const spacing = categories.length > 1 ? xScale.step() : dims.innerWidth;
    const r = Math.min(dotRadius, spacing / 2 - 1);
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat((d) => truncateLabel(d, 12)));
    styleAxis(xAxis);
    const needsRotation = shouldRotateLabels(categories, spacing);
    if (needsRotation) {
        g.selectAll('.x-axis .tick text')
            .attr('transform', 'rotate(-35)')
            .attr('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.15em');
    }
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3
        .axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(yAxis);
    g.selectAll('.lollipop-hover')
        .data(data)
        .join('rect')
        .attr('class', 'lollipop-hover')
        .attr('x', (d) => xScale(String(d[categoryField])) - spacing / 2)
        .attr('y', 0)
        .attr('width', spacing)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        const cat = String(d[categoryField]);
        const hoverSize = r * 1.3;
        g.selectAll('.lollipop-dot')
            .attr('opacity', (dd) => String(dd[categoryField]) === cat ? 1 : 0.25);
        g.selectAll('.lollipop-dot')
            .filter((dd) => String(dd[categoryField]) === cat)
            .attr('width', hoverSize * 2)
            .attr('height', hoverSize * 2)
            .attr('x', (dd) => xScale(String(dd[categoryField])) - hoverSize)
            .attr('y', (dd) => yScale(Number(dd[valueField])) - hoverSize);
        g.selectAll('.lollipop-stem')
            .attr('opacity', (dd) => String(dd[categoryField]) === cat ? 1 : 0.25);
        showTooltip(tooltip, `<strong>${d[categoryField]}</strong><br/>${valueField}: ${formatValue(Number(d[valueField]))}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.lollipop-dot')
            .attr('opacity', 1)
            .attr('width', r * 2)
            .attr('height', r * 2)
            .attr('x', (dd) => xScale(String(dd[categoryField])) - r)
            .attr('y', (dd) => yScale(Number(dd[valueField])) - r);
        g.selectAll('.lollipop-stem').attr('opacity', 1);
        hideTooltip(tooltip);
    });
    g.selectAll('.lollipop-stem')
        .data(data)
        .join('line')
        .attr('class', 'lollipop-stem')
        .attr('x1', (d) => xScale(String(d[categoryField])))
        .attr('x2', (d) => xScale(String(d[categoryField])))
        .attr('y1', baselineY)
        .attr('y2', (d) => {
        const val = Number(d[valueField]);
        return yScale(val) + (val >= 0 ? r : -r);
    })
        .attr('stroke', (d) => colorScale(d[encoding.color?.field || categoryField]))
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none');
    g.selectAll('.lollipop-dot')
        .data(data)
        .join('rect')
        .attr('class', 'lollipop-dot')
        .attr('x', (d) => xScale(String(d[categoryField])) - r)
        .attr('y', (d) => yScale(Number(d[valueField])) - r)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('rx', 2)
        .attr('fill', (d) => colorScale(d[encoding.color?.field || categoryField]))
        .attr('stroke', '#0f1117')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');
    if (r >= 12) {
        g.selectAll('.lollipop-label')
            .data(data)
            .join('text')
            .attr('class', 'lollipop-label')
            .attr('x', (d) => xScale(String(d[categoryField])))
            .attr('y', (d) => yScale(Number(d[valueField])))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', (d) => contrastText(colorScale(d[encoding.color?.field || categoryField])))
            .attr('font-size', `${Math.min(10, r - 3)}px`)
            .attr('font-weight', '600')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text((d) => formatValue(Number(d[valueField])));
    }
}
//# sourceMappingURL=lollipop.js.map