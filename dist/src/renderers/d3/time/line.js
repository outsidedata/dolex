/**
 * Line chart D3 renderer.
 * Handles single and multi-series time-based line charts with optional
 * area fills, point markers, and multiple interpolation modes.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, formatValue, styleAxis, getAdaptiveTickCount, createLegend, renderEmptyState, TEXT_MUTED, DARK_BG, DEFAULT_PALETTE, } from '../shared.js';
export function renderLine(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    const seriesField = config.seriesField || encoding.color?.field || null;
    const interpolation = config.interpolation || 'monotone';
    const showPoints = interpolation === 'step' ? false : (config.showPoints ?? data.length <= 50);
    const showArea = config.showArea ?? false;
    const strokeWidth = config.strokeWidth ?? 2;
    // Parse and filter data upfront
    const parsedData = data
        .map((d) => ({
        ...d,
        _date: parseDate(d[timeField]),
        _value: Number(d[valueField]),
    }))
        .filter((d) => d._date !== null && !isNaN(d._value));
    const colorScale = buildColorScale(encoding.color, data);
    // Determine if multi-series
    const seriesNames = seriesField
        ? [...new Set(parsedData.map((d) => d[seriesField]))]
        : [];
    const isMultiSeries = seriesNames.length > 1;
    // ── Container layout: flex column with chartWrapper + legend ──
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    // HTML legend below chart for multi-series
    if (isMultiSeries) {
        const legendDiv = createLegend(colorScale, { shape: 'line' });
        container.appendChild(legendDiv);
    }
    // ── SVG + scales ──
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        right: 30,
        top: 40,
    });
    svg.style('background', 'none');
    const tooltip = createTooltip(chartWrapper);
    // Check if all values are zero
    if (parsedData.every((d) => d._value === 0)) {
        renderEmptyState(g, dims);
        return;
    }
    // X scale (time)
    const xExtent = d3.extent(parsedData, (d) => d._date);
    const xScale = d3.scaleTime().domain(xExtent).range([0, dims.innerWidth]).nice();
    // Y scale (linear)
    const yExtent = d3.extent(parsedData, (d) => d._value);
    const yMin = showArea ? 0 : yExtent[0] * 0.9;
    const yScale = d3
        .scaleLinear()
        .domain([yMin, yExtent[1] * 1.05])
        .range([dims.innerHeight, 0])
        .nice();
    // ── Axes (direct creation + styleAxis) ──
    const xTickCount = getAdaptiveTickCount(dims.innerWidth);
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .ticks(xTickCount)
        .tickSize(0)
        .tickPadding(8));
    styleAxis(xAxis);
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
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
    // ── Interpolation ──
    const curveMap = {
        linear: d3.curveLinear,
        monotone: d3.curveMonotoneX,
        basis: d3.curveBasis,
        step: d3.curveStepAfter,
        cardinal: d3.curveCardinal,
        catmullRom: d3.curveCatmullRom,
    };
    const curve = curveMap[config.interpolation || 'monotone'] || d3.curveMonotoneX;
    const lineGen = d3
        .line()
        .x((d) => xScale(d._date))
        .y((d) => yScale(d._value))
        .curve(curve);
    const areaGen = d3
        .area()
        .x((d) => xScale(d._date))
        .y0(dims.innerHeight)
        .y1((d) => yScale(d._value))
        .curve(curve);
    // ── Draw lines (multi or single) ──
    const uniqueDates = new Set(parsedData.map((d) => d._date.getTime()));
    const isSinglePoint = uniqueDates.size <= 1;
    if (isSinglePoint) {
        const color = isMultiSeries ? undefined : DEFAULT_PALETTE[0];
        parsedData.forEach((d) => {
            const c = isMultiSeries ? colorScale(d[seriesField]) : color;
            g.append('circle')
                .attr('cx', xScale(d._date))
                .attr('cy', yScale(d._value))
                .attr('r', 6)
                .attr('fill', c)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
            g.append('text')
                .attr('x', xScale(d._date))
                .attr('y', yScale(d._value) - 14)
                .attr('text-anchor', 'middle')
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(formatValue(d._value));
        });
    }
    else if (isMultiSeries) {
        drawMultiSeries(g, parsedData, seriesField, seriesNames, colorScale, lineGen, areaGen, xScale, yScale, showArea, showPoints, strokeWidth);
    }
    else {
        drawSingleSeries(g, parsedData, lineGen, areaGen, xScale, yScale, showArea, showPoints, strokeWidth);
    }
    // ── Crosshair hover targets ──
    if (!isSinglePoint) {
        addCrosshairHover(g, parsedData, seriesField, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, isMultiSeries);
    }
}
// ── Helpers ──────────────────────────────────────────────────────────────────
function parseDate(v) {
    if (v instanceof Date)
        return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function drawMultiSeries(g, parsedData, seriesField, seriesNames, colorScale, lineGen, areaGen, xScale, yScale, showArea, showPoints, strokeWidth) {
    seriesNames.forEach((name) => {
        const seriesData = parsedData
            .filter((d) => d[seriesField] === name)
            .sort((a, b) => a._date.getTime() - b._date.getTime());
        const color = colorScale(name);
        if (showArea) {
            g.append('path')
                .datum(seriesData)
                .attr('fill', color)
                .attr('opacity', 0.1)
                .attr('d', areaGen)
                .attr('pointer-events', 'none');
        }
        g.append('path')
            .datum(seriesData)
            .attr('class', 'line-path')
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', strokeWidth)
            .attr('d', lineGen)
            .attr('pointer-events', 'none');
        if (showPoints) {
            g.selectAll(`.point-${String(name).replace(/\W/g, '')}`)
                .data(seriesData)
                .join('circle')
                .attr('class', `point-${String(name).replace(/\W/g, '')}`)
                .attr('cx', (d) => xScale(d._date))
                .attr('cy', (d) => yScale(d._value))
                .attr('r', 1.25)
                .attr('fill', color)
                .attr('stroke', DARK_BG)
                .attr('stroke-width', 1.5)
                .attr('pointer-events', 'none');
        }
    });
}
function drawSingleSeries(g, parsedData, lineGen, areaGen, xScale, yScale, showArea, showPoints, strokeWidth) {
    const sortedData = [...parsedData].sort((a, b) => a._date.getTime() - b._date.getTime());
    const color = DEFAULT_PALETTE[0];
    if (showArea) {
        g.append('path')
            .datum(sortedData)
            .attr('fill', color)
            .attr('opacity', 0.1)
            .attr('d', areaGen)
            .attr('pointer-events', 'none');
    }
    g.append('path')
        .datum(sortedData)
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', strokeWidth)
        .attr('d', lineGen)
        .attr('pointer-events', 'none');
    if (showPoints) {
        g.selectAll('.point')
            .data(sortedData)
            .join('circle')
            .attr('class', 'point')
            .attr('cx', (d) => xScale(d._date))
            .attr('cy', (d) => yScale(d._value))
            .attr('r', 1.25)
            .attr('fill', color)
            .attr('stroke', DARK_BG)
            .attr('stroke-width', 0.75)
            .attr('pointer-events', 'none');
    }
}
/**
 * Crosshair-style hover: vertical line + dots at intersections + tooltip with all series values.
 * Uses bisector to find the nearest data point to the cursor x position.
 */
function addCrosshairHover(g, parsedData, seriesField, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, isMultiSeries) {
    // Build sorted date → values lookup
    const dateMap = new Map();
    parsedData.forEach((d) => {
        const key = d._date.getTime();
        if (!dateMap.has(key))
            dateMap.set(key, []);
        dateMap.get(key).push(d);
    });
    const sortedDates = [...dateMap.keys()].sort((a, b) => a - b);
    // Crosshair vertical line (hidden by default)
    const crosshairLine = g.append('line')
        .attr('class', 'crosshair')
        .attr('y1', 0)
        .attr('y2', dims.innerHeight)
        .attr('stroke', TEXT_MUTED)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('pointer-events', 'none')
        .attr('opacity', 0);
    // Highlight dots group
    const highlightDots = g.append('g').attr('class', 'highlight-dots').attr('pointer-events', 'none');
    // Invisible rect for mouse events
    g.append('rect')
        .attr('class', 'hover-area')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        const xDate = xScale.invert(mx).getTime();
        // Bisect to find nearest date
        const bisect = d3.bisector((d) => d).left;
        let idx = bisect(sortedDates, xDate);
        if (idx > 0 && idx < sortedDates.length) {
            const d0 = sortedDates[idx - 1];
            const d1 = sortedDates[idx];
            idx = xDate - d0 > d1 - xDate ? idx : idx - 1;
        }
        else if (idx >= sortedDates.length) {
            idx = sortedDates.length - 1;
        }
        const nearestTime = sortedDates[idx];
        const nearestX = xScale(new Date(nearestTime));
        const points = dateMap.get(nearestTime) || [];
        // Show crosshair line
        crosshairLine.attr('x1', nearestX).attr('x2', nearestX).attr('opacity', 1);
        // Show highlight dots
        highlightDots.selectAll('circle').remove();
        points.forEach((d) => {
            const color = isMultiSeries ? colorScale(d[seriesField]) : DEFAULT_PALETTE[0];
            highlightDots.append('circle')
                .attr('cx', nearestX)
                .attr('cy', yScale(d._value))
                .attr('r', 5)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
        });
        // Dim all lines slightly
        g.selectAll('.line-path').attr('opacity', 0.4);
        // Build tooltip
        const dateLabel = points[0]?.[timeField] ?? new Date(nearestTime).toLocaleDateString();
        let html = `<strong>${dateLabel}</strong>`;
        if (isMultiSeries) {
            // Sort by value descending for readability
            const sorted = [...points].sort((a, b) => b._value - a._value);
            sorted.forEach((d) => {
                const color = colorScale(d[seriesField]);
                html += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px;vertical-align:middle;"></span>${d[seriesField]}: ${formatValue(d._value)}`;
            });
        }
        else {
            html += `<br/>${valueField}: ${formatValue(points[0]?._value)}`;
        }
        showTooltip(tooltip, html, event);
    })
        .on('mouseout', function () {
        crosshairLine.attr('opacity', 0);
        highlightDots.selectAll('circle').remove();
        g.selectAll('.line-path').attr('opacity', 1);
        hideTooltip(tooltip);
    });
}
//# sourceMappingURL=line.js.map