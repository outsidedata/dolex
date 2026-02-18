/**
 * Area chart D3 renderer.
 * Handles single-series area, stacked area, and normalized (100%) stacked area
 * charts over time. Line stroke on top of fill for clarity.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, formatValue, styleAxis, getAdaptiveTickCount, createLegend, renderEmptyState, TEXT_MUTED, DARK_BG, DEFAULT_PALETTE, } from '../shared.js';
export function renderArea(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    const seriesField = config.seriesField || encoding.color?.field || null;
    const stacked = config.stacked ?? false;
    const normalized = config.normalized ?? false;
    const fillOpacity = config.opacity ?? 0.7;
    const interpolation = config.curve || config.interpolation || 'monotone';
    const parsedData = data
        .map((d) => ({
        ...d,
        _date: parseDate(d[timeField]),
        _value: d[valueField] == null ? null : Number(d[valueField]),
    }))
        .filter((d) => d._date !== null);
    const colorScale = buildColorScale(encoding.color, data);
    const seriesNames = seriesField
        ? [...new Set(parsedData.map((d) => d[seriesField]))]
        : [];
    const isMultiSeries = seriesNames.length > 1;
    const isStacked = isMultiSeries && (stacked || normalized);
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    if (isMultiSeries) {
        const legendDiv = createLegend(colorScale);
        container.appendChild(legendDiv);
    }
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        right: 30,
        top: 40,
        bottom: 70,
    });
    svg.style('background', 'none');
    const tooltip = createTooltip(chartWrapper);
    // Check if all values are zero
    if (parsedData.every((d) => d._value === 0 || d._value === null)) {
        renderEmptyState(g, dims);
        return;
    }
    const curveMap = {
        linear: d3.curveLinear,
        monotone: d3.curveMonotoneX,
        curve: d3.curveBasis,
        step: d3.curveStepAfter,
        cardinal: d3.curveCardinal,
        catmullRom: d3.curveCatmullRom,
    };
    const curve = curveMap[interpolation] || d3.curveMonotoneX;
    // Single data point: render a visible dot instead of area
    const uniqueDateCount = new Set(parsedData.map((d) => d._date.getTime())).size;
    if (uniqueDateCount <= 1) {
        const xExtent = d3.extent(parsedData, (d) => d._date);
        const xScale = d3.scaleTime().domain(xExtent).range([0, dims.innerWidth]);
        const yExtent = d3.extent(parsedData, (d) => d._value);
        const yScale = d3.scaleLinear().domain([0, yExtent[1] * 1.1 || 1]).range([dims.innerHeight, 0]).nice();
        drawAxes(g, xScale, yScale, dims, false, 1);
        parsedData.forEach((d) => {
            const c = isMultiSeries ? colorScale(d[seriesField]) : DEFAULT_PALETTE[0];
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
    else if (isStacked) {
        drawStackedArea(g, parsedData, seriesField, seriesNames, colorScale, curve, dims, tooltip, timeField, valueField, fillOpacity, normalized);
    }
    else if (isMultiSeries) {
        drawOverlappingAreas(g, parsedData, seriesField, seriesNames, colorScale, curve, dims, tooltip, timeField, valueField, fillOpacity);
    }
    else {
        drawSingleArea(g, parsedData, curve, dims, tooltip, timeField, valueField, fillOpacity);
    }
}
function parseDate(v) {
    if (v instanceof Date)
        return v;
    if (v === null || v === undefined || v === '')
        return null;
    const num = typeof v === 'number' ? v : Number(v);
    if (!isNaN(num) && num > 1800 && num < 2200 && Math.floor(num) === num) {
        return new Date(num, 0, 1);
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function drawSingleArea(g, parsedData, curve, dims, tooltip, timeField, valueField, fillOpacity) {
    const sorted = [...parsedData].sort((a, b) => a._date.getTime() - b._date.getTime());
    const color = DEFAULT_PALETTE[0];
    const xExtent = d3.extent(sorted, (d) => d._date);
    const xScale = d3.scaleTime().domain(xExtent).range([0, dims.innerWidth]);
    const validValues = sorted.filter((d) => d._value !== null && !isNaN(d._value));
    const yMin = d3.min(validValues, (d) => d._value);
    const yMax = d3.max(validValues, (d) => d._value);
    const yScale = d3.scaleLinear().domain([Math.min(0, yMin), yMax * 1.05]).range([dims.innerHeight, 0]).nice();
    drawAxes(g, xScale, yScale, dims, false, sorted.length);
    const defined = (d) => d._value !== null && !isNaN(d._value);
    const areaGen = d3.area()
        .defined(defined)
        .x((d) => xScale(d._date))
        .y0(yScale(0))
        .y1((d) => yScale(d._value))
        .curve(curve);
    const lineGen = d3.line()
        .defined(defined)
        .x((d) => xScale(d._date))
        .y((d) => yScale(d._value))
        .curve(curve);
    g.append('path')
        .datum(sorted)
        .attr('fill', color)
        .attr('opacity', fillOpacity)
        .attr('d', areaGen)
        .attr('pointer-events', 'none');
    g.append('path')
        .datum(sorted)
        .attr('class', 'line-path')
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', lineGen)
        .attr('pointer-events', 'none');
    addCrosshairHover(g, sorted, null, [], timeField, valueField, null, xScale, yScale, dims, tooltip, false);
}
function drawOverlappingAreas(g, parsedData, seriesField, seriesNames, colorScale, curve, dims, tooltip, timeField, valueField, fillOpacity) {
    const xExtent = d3.extent(parsedData, (d) => d._date);
    const xScale = d3.scaleTime().domain(xExtent).range([0, dims.innerWidth]);
    const validValues = parsedData.filter((d) => d._value !== null && !isNaN(d._value));
    const yMinO = d3.min(validValues, (d) => d._value);
    const yMax = d3.max(validValues, (d) => d._value);
    const yScale = d3.scaleLinear().domain([Math.min(0, yMinO), yMax * 1.05]).range([dims.innerHeight, 0]).nice();
    const uniqueTimes = new Set(parsedData.map((d) => d._date.getTime())).size;
    drawAxes(g, xScale, yScale, dims, false, uniqueTimes);
    const defined = (d) => d._value !== null && !isNaN(d._value);
    const areaGen = d3.area()
        .defined(defined)
        .x((d) => xScale(d._date))
        .y0(yScale(0))
        .y1((d) => yScale(d._value))
        .curve(curve);
    const lineGen = d3.line()
        .defined(defined)
        .x((d) => xScale(d._date))
        .y((d) => yScale(d._value))
        .curve(curve);
    seriesNames.forEach((name) => {
        const seriesData = parsedData
            .filter((d) => d[seriesField] === name)
            .sort((a, b) => a._date.getTime() - b._date.getTime());
        const color = colorScale(name);
        g.append('path')
            .datum(seriesData)
            .attr('fill', color)
            .attr('opacity', fillOpacity * 0.5)
            .attr('d', areaGen)
            .attr('pointer-events', 'none');
        g.append('path')
            .datum(seriesData)
            .attr('class', 'line-path')
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('d', lineGen)
            .attr('pointer-events', 'none');
    });
    addCrosshairHover(g, parsedData, seriesField, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, true);
}
function drawStackedArea(g, parsedData, seriesField, seriesNames, colorScale, curve, dims, tooltip, timeField, valueField, fillOpacity, normalized) {
    const dateMap = new Map();
    parsedData.forEach((d) => {
        const key = d._date.getTime();
        if (!dateMap.has(key))
            dateMap.set(key, {});
        dateMap.get(key)[d[seriesField]] = d._value;
    });
    const sortedTimes = [...dateMap.keys()].sort((a, b) => a - b);
    const wideData = sortedTimes.map((t) => {
        const row = { _date: new Date(t) };
        const values = dateMap.get(t);
        seriesNames.forEach((name) => {
            row[name] = values[name] || 0;
        });
        return row;
    });
    const stackGen = d3.stack().keys(seriesNames);
    if (normalized) {
        stackGen.offset(d3.stackOffsetExpand);
    }
    const stacked = stackGen(wideData);
    const xScale = d3.scaleTime()
        .domain(d3.extent(wideData, (d) => d._date))
        .range([0, dims.innerWidth]);
    let yMinS;
    let yMaxS;
    if (normalized) {
        yMinS = 0;
        yMaxS = 1;
    }
    else {
        yMinS = d3.min(stacked, (layer) => d3.min(layer, (d) => d[0]));
        yMaxS = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1]));
    }
    const yScale = d3.scaleLinear().domain([Math.min(0, yMinS), yMaxS]).range([dims.innerHeight, 0]).nice();
    drawAxes(g, xScale, yScale, dims, normalized, wideData.length);
    const areaGen = d3.area()
        .x((d) => xScale(d.data._date))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(curve);
    stacked.forEach((layer) => {
        const color = colorScale(layer.key);
        g.append('path')
            .datum(layer)
            .attr('fill', color)
            .attr('opacity', fillOpacity)
            .attr('d', areaGen)
            .attr('pointer-events', 'none');
        const lineGen = d3.line()
            .x((d) => xScale(d.data._date))
            .y((d) => yScale(d[1]))
            .curve(curve);
        g.append('path')
            .datum(layer)
            .attr('class', 'line-path')
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .attr('d', lineGen)
            .attr('pointer-events', 'none');
    });
    addStackedCrosshairHover(g, wideData, stacked, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, normalized);
}
function drawAxes(g, xScale, yScale, dims, normalized, dataPointCount) {
    let xTickCount = getAdaptiveTickCount(dims.innerWidth);
    if (dataPointCount && dataPointCount < xTickCount) {
        xTickCount = dataPointCount;
    }
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3.axisBottom(xScale).ticks(xTickCount).tickSize(0).tickPadding(8));
    styleAxis(xAxis);
    xAxis.selectAll('.tick text')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.15em')
        .attr('transform', 'rotate(-35)');
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    const yAxisCall = d3.axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8);
    if (normalized) {
        yAxisCall.tickFormat((d) => Math.round(d * 100) + '%');
    }
    else {
        yAxisCall.tickFormat((d) => formatValue(d));
    }
    const yAxis = g.append('g').attr('class', 'y-axis').call(yAxisCall);
    styleAxis(yAxis);
}
function addCrosshairHover(g, parsedData, seriesField, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, isMultiSeries) {
    const dateMap = new Map();
    parsedData.forEach((d) => {
        const key = d._date.getTime();
        if (!dateMap.has(key))
            dateMap.set(key, []);
        dateMap.get(key).push(d);
    });
    const sortedDates = [...dateMap.keys()].sort((a, b) => a - b);
    const crosshairLine = g.append('line')
        .attr('class', 'crosshair')
        .attr('y1', 0)
        .attr('y2', dims.innerHeight)
        .attr('stroke', TEXT_MUTED)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('pointer-events', 'none')
        .attr('opacity', 0);
    const highlightDots = g.append('g').attr('class', 'highlight-dots').attr('pointer-events', 'none');
    g.append('rect')
        .attr('class', 'hover-area')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        const xDate = xScale.invert(mx).getTime();
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
        crosshairLine.attr('x1', nearestX).attr('x2', nearestX).attr('opacity', 1);
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
        const dateLabel = points[0]?.[timeField] ?? new Date(nearestTime).toLocaleDateString();
        let html = `<strong>${dateLabel}</strong>`;
        if (isMultiSeries) {
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
        hideTooltip(tooltip);
    });
}
function addStackedCrosshairHover(g, wideData, stacked, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, normalized) {
    const sortedDates = wideData.map((d) => d._date.getTime());
    const crosshairLine = g.append('line')
        .attr('class', 'crosshair')
        .attr('y1', 0)
        .attr('y2', dims.innerHeight)
        .attr('stroke', TEXT_MUTED)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('pointer-events', 'none')
        .attr('opacity', 0);
    const highlightDots = g.append('g').attr('class', 'highlight-dots').attr('pointer-events', 'none');
    g.append('rect')
        .attr('class', 'hover-area')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        const xDate = xScale.invert(mx).getTime();
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
        const nearestX = xScale(wideData[idx]._date);
        crosshairLine.attr('x1', nearestX).attr('x2', nearestX).attr('opacity', 1);
        highlightDots.selectAll('circle').remove();
        const dateStr = wideData[idx]._date.toLocaleDateString();
        let html = `<strong>${dateStr}</strong>`;
        const reversedNames = [...seriesNames].reverse();
        reversedNames.forEach((name) => {
            const layer = stacked.find((l) => l.key === name);
            if (!layer)
                return;
            const pt = layer[idx];
            const val = pt.data[name];
            const stackedY = yScale(pt[1]);
            const color = colorScale(name);
            highlightDots.append('circle')
                .attr('cx', nearestX)
                .attr('cy', stackedY)
                .attr('r', 4)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
            if (normalized) {
                const pct = ((pt[1] - pt[0]) * 100).toFixed(1);
                html += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px;vertical-align:middle;"></span>${name}: ${formatValue(val)} (${pct}%)`;
            }
            else {
                html += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px;vertical-align:middle;"></span>${name}: ${formatValue(val)}`;
            }
        });
        showTooltip(tooltip, html, event);
    })
        .on('mouseout', function () {
        crosshairLine.attr('opacity', 0);
        highlightDots.selectAll('circle').remove();
        hideTooltip(tooltip);
    });
}
//# sourceMappingURL=area.js.map