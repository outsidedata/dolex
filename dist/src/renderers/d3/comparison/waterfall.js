/**
 * Waterfall chart D3 renderer — floating bars showing cumulative positive/negative contributions.
 */
import { createSvg, createLegend, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, styleAxis, getAdaptiveTickCount, shouldRotateLabels, calculateBottomMargin, truncateLabel, shouldShowValueLabels, contrastText, TEXT_MUTED, DARK_BG, AXIS_COLOR, GRID_COLOR, } from '../shared.js';
import { categorical } from '../../../theme/colors.js';
export function renderWaterfall(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    if (!categoryField || !valueField)
        return;
    const totalColumns = new Set();
    if (Array.isArray(config.totalColumns)) {
        for (const t of config.totalColumns) {
            if (t === 'first')
                totalColumns.add(String(data[0]?.[categoryField]));
            else if (t === 'last')
                totalColumns.add(String(data[data.length - 1]?.[categoryField]));
            else
                totalColumns.add(String(t));
        }
    }
    else {
        if (data.length >= 2) {
            totalColumns.add(String(data[0]?.[categoryField]));
            totalColumns.add(String(data[data.length - 1]?.[categoryField]));
        }
    }
    const items = [];
    let running = 0;
    for (const d of data) {
        const label = String(d[categoryField]);
        const value = Number(d[valueField]) || 0;
        const isTotal = totalColumns.has(label);
        if (isTotal) {
            items.push({
                label,
                value,
                isTotal: true,
                start: 0,
                end: value,
                type: 'total',
            });
            running = value;
        }
        else {
            const start = running;
            running += value;
            items.push({
                label,
                value,
                isTotal: false,
                start,
                end: running,
                type: value >= 0 ? 'positive' : 'negative',
            });
        }
    }
    const positiveColor = config.positiveColor || '#3dd9a0';
    const negativeColor = config.negativeColor || '#ff6b5e';
    const totalColor = config.totalColor || categorical[0];
    const showConnectors = config.showConnectors !== false;
    const labels = items.map((d) => d.label);
    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;
    const showLegend = containerHeight > 250 && containerWidth > 300;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    if (showLegend) {
        const legendDiv = createLegend([
            { label: 'Increase', color: positiveColor },
            { label: 'Decrease', color: negativeColor },
            { label: 'Total', color: totalColor },
        ]);
        container.appendChild(legendDiv);
    }
    const estBarWidth = (containerWidth - 140) / labels.length;
    const willRotate = shouldRotateLabels(labels, estBarWidth);
    const bottomMargin = calculateBottomMargin(labels, willRotate);
    const { svg, g, dims } = createSvg(chartWrapper, spec, { bottom: bottomMargin, left: 70, top: 40, right: 30 });
    svg.style('background', 'none').style('border-radius', '0');
    const tooltip = createTooltip(container);
    const allValues = items.flatMap((d) => [d.start, d.end]);
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(0, ...allValues);
    const xScale = d3.scaleBand().domain(labels).range([0, dims.innerWidth]).padding(0.3);
    const yScale = d3.scaleLinear().domain([minVal, maxVal]).range([dims.innerHeight, 0]).nice();
    const xAxis = g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(8)
        .tickFormat((d) => truncateLabel(d, 20)));
    styleAxis(xAxis);
    if (willRotate) {
        g.selectAll('.x-axis .tick text')
            .attr('transform', 'rotate(-35)')
            .attr('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.15em');
    }
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    const yAxis = g.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale).ticks(yTickCount).tickSize(-dims.innerWidth).tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(yAxis);
    if (minVal < 0) {
        g.append('line')
            .attr('x1', 0).attr('x2', dims.innerWidth)
            .attr('y1', yScale(0)).attr('y2', yScale(0))
            .attr('stroke', AXIS_COLOR)
            .attr('stroke-width', 1);
    }
    if (showConnectors) {
        for (let i = 0; i < items.length - 1; i++) {
            const current = items[i];
            const next = items[i + 1];
            const connectY = yScale(current.end);
            const x1 = (xScale(current.label) ?? 0) + xScale.bandwidth();
            const x2 = xScale(next.label) ?? 0;
            g.append('line')
                .attr('class', 'connector')
                .attr('x1', x1).attr('x2', x2)
                .attr('y1', connectY).attr('y2', connectY)
                .attr('stroke', GRID_COLOR)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,3');
        }
    }
    g.selectAll('.bar-hover-target')
        .data(items)
        .join('rect')
        .attr('class', 'bar-hover-target')
        .attr('x', (d) => xScale(d.label))
        .attr('y', 0)
        .attr('width', xScale.bandwidth())
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        g.selectAll(`.bar[data-label="${CSS.escape(d.label)}"]`).attr('opacity', 0.8);
        const prefix = d.isTotal ? 'Total' : (d.value >= 0 ? '+' : '');
        showTooltip(tooltip, `<strong>${d.label}</strong><br/>${prefix}${formatValue(d.value)}<br/>Running: ${formatValue(d.end)}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.bar').attr('opacity', 1);
        hideTooltip(tooltip);
    });
    // Clamp bar width for single/few items
    const maxBarWidth = Math.min(80, dims.innerWidth * 0.3);
    const wBarWidth = Math.min(xScale.bandwidth(), maxBarWidth);
    const wBarOffset = (xScale.bandwidth() - wBarWidth) / 2;
    g.selectAll('.bar')
        .data(items)
        .join('rect')
        .attr('class', 'bar')
        .attr('data-label', (d) => d.label)
        .attr('x', (d) => (xScale(d.label) ?? 0) + wBarOffset)
        .attr('y', (d) => yScale(Math.max(d.start, d.end)))
        .attr('width', wBarWidth)
        .attr('height', (d) => Math.max(2, Math.abs(yScale(d.start) - yScale(d.end))))
        .attr('fill', (d) => {
        if (d.type === 'total')
            return totalColor;
        return d.type === 'positive' ? positiveColor : negativeColor;
    })
        .attr('rx', 2)
        .attr('pointer-events', 'none');
    const showLabels = shouldShowValueLabels(config, xScale.bandwidth(), false);
    if (showLabels) {
        g.selectAll('.bar-label')
            .data(items)
            .join('text')
            .attr('class', 'bar-label')
            .attr('x', (d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2)
            .attr('y', (d) => {
            const top = yScale(Math.max(d.start, d.end));
            const barH = Math.abs(yScale(d.start) - yScale(d.end));
            return barH < 20 ? top - 6 : top + 14;
        })
            .attr('text-anchor', 'middle')
            .attr('fill', (d) => {
            const barH = Math.abs(yScale(d.start) - yScale(d.end));
            if (barH < 20)
                return TEXT_MUTED;
            const fillColor = d.type === 'total' ? totalColor : (d.type === 'positive' ? positiveColor : negativeColor);
            return contrastText(fillColor);
        })
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text((d) => {
            const prefix = d.isTotal ? '' : (d.value >= 0 ? '+' : '');
            return prefix + formatValue(d.value);
        });
    }
}
//# sourceMappingURL=waterfall.js.map