/**
 * Stacked bar chart D3 renderer.
 * Follows bar chart standards: adaptive layout, full-column hover, instant render, value labels.
 */
import { createSvg, buildColorScale, addSortControls, createTooltip, showTooltip, hideTooltip, positionTooltip, createLegend, formatValue, truncateLabel, styleAxis, getAdaptiveTickCount, shouldRotateLabels, calculateBottomMargin, shouldShowValueLabels, DARK_BG, TEXT_MUTED, } from '../shared.js';
export function renderStackedBar(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.x?.field;
    const seriesField = config.seriesField || encoding.color?.field;
    const valueField = config.valueField || encoding.y?.field;
    const isNormalized = config.normalized || false;
    // Get unique categories and series
    let categories = [...new Set(data.map((d) => d[categoryField]))];
    const series = [...new Set(data.map((d) => d[seriesField]))];
    // Build pivot table: category -> series -> value
    const pivoted = {};
    const totals = {};
    categories.forEach((cat) => {
        pivoted[cat] = {};
        let total = 0;
        series.forEach((s) => {
            const row = data.find((d) => d[categoryField] === cat && d[seriesField] === s);
            const val = row ? Number(row[valueField]) || 0 : 0;
            pivoted[cat][s] = val;
            total += val;
        });
        totals[cat] = total;
    });
    // Sort categories
    if (config.sortBy === 'value') {
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        categories.sort((a, b) => order * (totals[a] - totals[b]));
    }
    else if (config.sortBy === 'category') {
        const order = config.sortOrder === 'ascending' ? 1 : -1;
        categories.sort((a, b) => order * String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }));
    }
    // Compute stacked data (in sorted category order)
    const stackData = categories.map((cat) => {
        const entry = { _category: cat };
        const total = totals[cat];
        series.forEach((s) => {
            const val = pivoted[cat][s] || 0;
            entry[s] = isNormalized && total > 0 ? (val / total) * 100 : val;
        });
        entry._total = isNormalized ? 100 : total;
        return entry;
    });
    const hasNegatives = stackData.some((d) => series.some((s) => d[s] < 0));
    const stack = d3.stack().keys(series);
    if (hasNegatives) {
        stack.offset(d3.stackOffsetDiverging);
    }
    const stacked = stack(stackData);
    const containerWidth = container.clientWidth || 800;
    const containerHeight = container.clientHeight || 500;
    // Hide legend in tiny containers
    const showLegend = containerHeight > 250 && containerWidth > 350;
    // Build color scale early so legend can use it
    const colorScale = buildColorScale(encoding.color, data);
    // Set up container as flex column: chart wrapper on top, legend div on bottom
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
        legendDiv = createLegend(colorScale);
        container.appendChild(legendDiv);
    }
    // Adaptive margins
    const estimatedBarWidth = (containerWidth - 130) / categories.length;
    const needsRotation = shouldRotateLabels(categories.map(String), estimatedBarWidth);
    const bottomMargin = calculateBottomMargin(categories.map(String), needsRotation);
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        bottom: bottomMargin,
        left: 70,
        right: 30,
        top: 40,
    });
    // Remove the default background from SVG — container handles it now
    svg.style('background', 'none').style('border-radius', '0');
    const tooltip = createTooltip(container);
    // Scales
    const xScale = d3.scaleBand().domain(categories).range([0, dims.innerWidth]).padding(0.2);
    let minY;
    let maxY;
    if (isNormalized) {
        minY = 0;
        maxY = 100;
    }
    else if (hasNegatives) {
        minY = d3.min(stacked, (layer) => d3.min(layer, (d) => d[0]));
        maxY = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1]));
    }
    else {
        minY = 0;
        maxY = d3.max(stackData, (d) => d._total);
    }
    const yScale = d3
        .scaleLinear()
        .domain([minY, maxY])
        .range([dims.innerHeight, 0])
        .nice();
    // Draw x-axis (categorical)
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat((d) => truncateLabel(d, 25)));
    styleAxis(xAxis);
    // Smart label rotation
    if (needsRotation) {
        g.selectAll('.x-axis .tick text')
            .attr('transform', 'rotate(-35)')
            .attr('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.15em');
    }
    // Draw y-axis with adaptive ticks and formatted values
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3
        .axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8)
        .tickFormat((d) => isNormalized ? d + '%' : formatValue(d)));
    styleAxis(yAxis);
    // Full-column invisible hover targets (bar chart standard)
    g.selectAll('.bar-hover-target')
        .data(stackData)
        .join('rect')
        .attr('class', 'bar-hover-target')
        .attr('x', (d) => xScale(d._category))
        .attr('y', 0)
        .attr('width', xScale.bandwidth())
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        // Highlight all segments in this column
        g.selectAll('.segment')
            .filter((sd) => sd.data._category === d._category)
            .attr('opacity', 0.8);
        // Build multi-series tooltip
        let html = `<strong>${d._category}</strong>`;
        series.forEach((s) => {
            const val = d[s];
            if (val > 0) {
                const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${colorScale(s)};margin-right:4px"></span>`;
                html += `<br/>${swatch}${s}: ${isNormalized ? val.toFixed(1) + '%' : formatValue(val)}`;
            }
        });
        if (!isNormalized) {
            html += `<br/><span style="color:${TEXT_MUTED};font-size:11px">Total: ${formatValue(d._total)}</span>`;
        }
        showTooltip(tooltip, html, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.segment').attr('opacity', 1);
        hideTooltip(tooltip);
    });
    // Clamp bar width for single/few items
    const maxBarWidth = Math.min(100, dims.innerWidth * 0.35);
    const stackBarWidth = Math.min(xScale.bandwidth(), maxBarWidth);
    const stackBarOffset = (xScale.bandwidth() - stackBarWidth) / 2;
    // Draw stacked bars (instant, no animation)
    g.selectAll('.series')
        .data(stacked)
        .join('g')
        .attr('class', 'series')
        .attr('fill', (d) => colorScale(d.key))
        .selectAll('rect')
        .data((d) => d.map((v) => ({ ...v, key: d.key })))
        .join('rect')
        .attr('class', 'segment')
        .attr('x', (d) => xScale(d.data._category) + stackBarOffset)
        .attr('y', (d) => Math.min(yScale(d[0]), yScale(d[1])))
        .attr('width', stackBarWidth)
        .attr('height', (d) => Math.abs(yScale(d[0]) - yScale(d[1])))
        .attr('rx', 1)
        .attr('pointer-events', 'none');
    // Value labels on segments (auto-enabled when segments are large enough)
    const showLabels = shouldShowValueLabels(config, xScale.bandwidth(), false);
    if (showLabels) {
        const allSegments = [];
        stacked.forEach((seriesData) => {
            seriesData.forEach((d) => {
                const val = d[1] - d[0];
                if (val > 0) {
                    allSegments.push({ ...d, key: seriesData.key, value: val });
                }
            });
        });
        g.selectAll('.segment-label')
            .data(allSegments)
            .join('text')
            .attr('class', 'segment-label')
            .attr('x', (d) => xScale(d.data._category) + xScale.bandwidth() / 2)
            .attr('y', (d) => {
            const segmentHeight = yScale(d[0]) - yScale(d[1]);
            return yScale(d[1]) + segmentHeight / 2;
        })
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#ffffff')
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text((d) => {
            const segmentHeight = yScale(d[0]) - yScale(d[1]);
            // Only show label if segment is tall enough to fit text
            if (segmentHeight < 16)
                return '';
            return isNormalized ? d.value.toFixed(0) + '%' : formatValue(d.value);
        });
    }
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
    // Sort controls (show on hover, top-right corner)
    addSortControls(svg, container, spec, dims, renderStackedBar);
}
//# sourceMappingURL=stacked-bar.js.map