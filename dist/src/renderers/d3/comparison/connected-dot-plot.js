/**
 * Connected dot plot D3 renderer.
 *
 * For each category row, draws a horizontal line segment from value1 to value2,
 * with colored dots at each end. Y-axis is categorical (scaleBand),
 * X-axis is quantitative (scaleLinear).
 */
import { createSvg, buildColorScale, createLegend, addSortControls, contrastText, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, styleAxis, calculateLeftMargin, renderEmptyState, isAllZeros, DEFAULT_PALETTE, GRID_COLOR, TEXT_MUTED, DARK_BG, } from '../shared.js';
export function renderConnectedDotPlot(container, spec) {
    const { config, encoding, data } = spec;
    const startField = config.metric1Field || config.startField || 'start';
    const endField = config.metric2Field || config.endField || 'end';
    const categoryField = config.categoryField || encoding.y?.field || 'category';
    const showLabels = config.showLabels !== false;
    const showDifference = config.showDifference === true;
    const startLabel = config.metric1Field || config.startLabel || startField;
    const endLabel = config.metric2Field || config.endLabel || endField;
    // Sort data
    let sortedData = [...data];
    if (config.sortBy === 'value' || config.sortBy === 'gap') {
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        sortedData.sort((a, b) => {
            const diffA = Number(a[endField]) - Number(a[startField]);
            const diffB = Number(b[endField]) - Number(b[startField]);
            return order * (diffA - diffB);
        });
    }
    else if (config.sortBy === 'category') {
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        sortedData.sort((a, b) => {
            return order * String(a[categoryField]).localeCompare(String(b[categoryField]), undefined, { sensitivity: 'base', numeric: true });
        });
    }
    // Dot radius is determined after we know the bandwidth (row height)
    // Set up container as flex column: chart on top, legend on bottom
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    // HTML legend below the chart
    const legendDiv = createLegend([
        { label: startLabel, color: DEFAULT_PALETTE[0] },
        { label: endLabel, color: DEFAULT_PALETTE[1] },
    ], { shape: 'circle' });
    container.appendChild(legendDiv);
    // Calculate left margin based on category label lengths
    const categories = sortedData.map((d) => String(d[categoryField]));
    const leftMargin = calculateLeftMargin(categories);
    const { svg, g, dims } = createSvg(chartWrapper, spec, { left: leftMargin });
    const tooltip = createTooltip(chartWrapper);
    // Check if both value fields are all zeros
    if (isAllZeros(sortedData, startField) && isAllZeros(sortedData, endField)) {
        svg.style('background', 'none');
        renderEmptyState(g, dims);
        return;
    }
    // Y scale — categorical
    const yScale = d3
        .scaleBand()
        .domain(categories)
        .range([0, dims.innerHeight])
        .padding(0.3);
    // X scale — quantitative, spanning both start and end values
    const allValues = sortedData.flatMap((d) => [Number(d[startField]), Number(d[endField])]);
    const minVal = d3.min(allValues);
    const maxVal = d3.max(allValues);
    const padding = (maxVal - minVal) * 0.08 || 1;
    const xScale = d3
        .scaleLinear()
        .domain([minVal - padding, maxVal + padding])
        .range([0, dims.innerWidth])
        .nice();
    // Axes
    // X-axis with gridlines
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .ticks(6)
        .tickSize(-dims.innerHeight)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(xAxis);
    // Y-axis (categorical, no gridlines)
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3
        .axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat((d) => {
        if (d.length > 30)
            return d.slice(0, 29) + '\u2026';
        return d;
    }));
    styleAxis(yAxis);
    // Color scale — use first two palette colors for start/end dots
    const colorScale = buildColorScale(encoding.color, sortedData);
    const startColor = DEFAULT_PALETTE[0];
    const endColor = DEFAULT_PALETTE[1];
    // Draw connecting lines and dots for each category
    const bandwidth = yScale.bandwidth();
    // Adaptive dot sizing — never larger than the row, small mode drops labels
    const maxDotRadius = Math.floor(bandwidth / 2);
    const LABEL_RADIUS = 11; // ideal size when labels are shown inside
    const SMALL_RADIUS = 5; // compact mode
    const isSmallMode = maxDotRadius < LABEL_RADIUS;
    const canShowLabels = showLabels && !isSmallMode;
    const DOT_RADIUS = canShowLabels
        ? Math.min(LABEL_RADIUS, maxDotRadius)
        : Math.min(SMALL_RADIUS, maxDotRadius);
    // Invisible full-width row hover targets (drawn first, behind everything)
    // Each row gets a rect spanning the full chart width so the user doesn't
    // have to hunt for tiny dots.
    g.selectAll('.row-hover-target')
        .data(sortedData)
        .join('rect')
        .attr('class', 'row-hover-target')
        .attr('x', 0)
        .attr('y', (d) => yScale(String(d[categoryField])))
        .attr('width', dims.innerWidth)
        .attr('height', bandwidth)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        const cat = String(d[categoryField]);
        const startVal = Number(d[startField]);
        const endVal = Number(d[endField]);
        const diff = endVal - startVal;
        // Highlight: brighten this row's dots
        g.selectAll(`.dot-${css(cat)}`).attr('opacity', 0.8).attr('r', DOT_RADIUS + 2);
        showTooltip(tooltip, `<strong>${cat}</strong><br/>${startLabel}: ${formatValue(startVal)}<br/>${endLabel}: ${formatValue(endVal)}<br/>Difference: ${diff >= 0 ? '+' : ''}${formatValue(diff)}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function (_event, d) {
        const cat = String(d[categoryField]);
        g.selectAll(`.dot-${css(cat)}`).attr('opacity', 1).attr('r', DOT_RADIUS);
        hideTooltip(tooltip);
    });
    // Draw lines, dots, and labels per row
    sortedData.forEach((d) => {
        const cat = String(d[categoryField]);
        const startVal = Number(d[startField]);
        const endVal = Number(d[endField]);
        const yMid = yScale(cat) + bandwidth / 2;
        const x1 = xScale(startVal);
        const x2 = xScale(endVal);
        // Determine left/right so rightmost dot is always drawn on top
        const leftIsStart = x1 <= x2;
        const leftX = leftIsStart ? x1 : x2;
        const rightX = leftIsStart ? x2 : x1;
        const leftColor = leftIsStart ? startColor : endColor;
        const rightColor = leftIsStart ? endColor : startColor;
        const leftVal = leftIsStart ? startVal : endVal;
        const rightVal = leftIsStart ? endVal : startVal;
        const dotClass = `dot-${css(cat)}`;
        // 1) Connecting line (behind dots)
        g.append('line')
            .attr('x1', x1)
            .attr('y1', yMid)
            .attr('x2', x2)
            .attr('y2', yMid)
            .attr('stroke', GRID_COLOR)
            .attr('stroke-width', 2)
            .attr('opacity', 0.6)
            .attr('pointer-events', 'none');
        // 2) Left dot + label (drawn first, can be covered by right dot)
        drawDot(g, leftX, yMid, DOT_RADIUS, leftColor, dotClass);
        const dotsTooClose = Math.abs(rightX - leftX) < DOT_RADIUS * 2.5;
        if (canShowLabels && !dotsTooClose) {
            drawLabel(g, leftX, yMid, leftVal, leftColor);
        }
        // 3) Right dot + label (drawn last, always on top)
        drawDot(g, rightX, yMid, DOT_RADIUS, rightColor, dotClass);
        if (canShowLabels) {
            drawLabel(g, rightX, yMid, rightVal, rightColor);
        }
        // Difference label (centered on the connecting line)
        if (showDifference) {
            const diff = endVal - startVal;
            const midX = (x1 + x2) / 2;
            g.append('text')
                .attr('x', midX)
                .attr('y', yMid)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '9px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .attr('pointer-events', 'none')
                .text(`${diff >= 0 ? '+' : ''}${formatValue(diff)}`);
        }
    });
    // Sort controls (show on hover, top-right corner)
    addSortControls(svg, container, spec, dims, renderConnectedDotPlot);
}
/** Sanitize a category string into a valid CSS class fragment. */
function css(cat) {
    return cat.replace(/[^a-zA-Z0-9]/g, '_');
}
function drawDot(g, cx, cy, r, color, className) {
    g.append('circle')
        .attr('class', className)
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', r)
        .attr('fill', color)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none');
}
function drawLabel(g, cx, cy, value, bgColor) {
    g.append('text')
        .attr('x', cx)
        .attr('y', cy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('fill', contrastText(bgColor))
        .attr('font-size', '8px')
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(formatValue(value));
}
//# sourceMappingURL=connected-dot-plot.js.map