/**
 * Stream Graph D3 renderer.
 * Stacked area chart with wiggle/silhouette/expand offset — layers flow
 * around a central axis for an organic, flowing visualization of
 * composition over time.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, createLegend, highlightLegendItem, formatValue, renderEmptyState, TEXT_MUTED, DARK_BG, styleAxis, getAdaptiveTickCount, } from '../shared.js';
export function renderStreamGraph(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    const seriesField = config.seriesField || encoding.color?.field;
    const offsetMode = config.offset || 'wiggle';
    const curveMode = config.curve || 'basis';
    const interactive = config.interactive !== false;
    if (!timeField || !valueField || !seriesField)
        return;
    const parsedData = data
        .map((d) => ({
        ...d,
        _date: parseDate(d[timeField]),
        _value: Number(d[valueField]) || 0,
        _series: String(d[seriesField]),
    }))
        .filter((d) => d._date !== null);
    if (parsedData.length === 0)
        return;
    const seriesNames = [...new Set(parsedData.map((d) => d._series))];
    const dateMap = new Map();
    parsedData.forEach((d) => {
        const key = d._date.getTime();
        if (!dateMap.has(key))
            dateMap.set(key, {});
        dateMap.get(key)[d._series] = (dateMap.get(key)[d._series] || 0) + d._value;
    });
    const sortedTimes = [...dateMap.keys()].sort((a, b) => a - b);
    if (sortedTimes.length === 0)
        return;
    const wideData = sortedTimes.map((t) => {
        const row = { _date: new Date(t) };
        const values = dateMap.get(t);
        seriesNames.forEach((name) => {
            row[name] = values[name] || 0;
        });
        return row;
    });
    const offsetMap = {
        wiggle: d3.stackOffsetWiggle,
        silhouette: d3.stackOffsetSilhouette,
        expand: d3.stackOffsetExpand,
    };
    const curveMap = {
        basis: d3.curveBasis,
        monotone: d3.curveMonotoneX,
        cardinal: d3.curveCardinal,
    };
    const hasNegativeValues = wideData.some((row) => seriesNames.some((name) => row[name] < 0));
    const stackOffset = hasNegativeValues
        ? d3.stackOffsetDiverging
        : (offsetMap[offsetMode] || d3.stackOffsetWiggle);
    const curve = curveMap[curveMode] || d3.curveBasis;
    const stackGen = d3
        .stack()
        .keys(seriesNames)
        .offset(stackOffset)
        .order(d3.stackOrderInsideOut);
    const stacked = stackGen(wideData);
    // Check if all values are zero
    if (parsedData.every((d) => d._value === 0)) {
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.background = DARK_BG;
        container.style.borderRadius = '8px';
        const chartWrapper = document.createElement('div');
        chartWrapper.style.flex = '1';
        container.appendChild(chartWrapper);
        const { svg, g, dims } = createSvg(chartWrapper, spec);
        svg.style('background', 'none');
        renderEmptyState(g, dims);
        return;
    }
    const colorScale = buildColorScale(encoding.color, data);
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    const legendDiv = createLegend(colorScale);
    container.appendChild(legendDiv);
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        right: 40,
        top: 40,
        left: 40,
        bottom: 50,
    });
    const tooltip = createTooltip(chartWrapper);
    // Single time point: render dots instead of streams
    if (sortedTimes.length <= 1) {
        const xMid = dims.innerWidth / 2;
        const total = seriesNames.reduce((s, n) => s + (wideData[0]?.[n] || 0), 0);
        const yScale = d3.scaleLinear().domain([0, total || 1]).range([dims.innerHeight, 0]).nice();
        let yPos = 20;
        seriesNames.forEach((name) => {
            const val = wideData[0]?.[name] || 0;
            g.append('circle').attr('cx', xMid).attr('cy', yPos).attr('r', 5).attr('fill', colorScale(name));
            g.append('text').attr('x', xMid + 12).attr('y', yPos).attr('dominant-baseline', 'central')
                .attr('fill', TEXT_MUTED).attr('font-size', '11px').attr('font-family', 'Inter, system-ui, sans-serif')
                .text(`${name}: ${formatValue(val)}`);
            yPos += 24;
        });
        return;
    }
    const xScale = d3
        .scaleTime()
        .domain(d3.extent(wideData, (d) => d._date))
        .range([0, dims.innerWidth]);
    const yMin = d3.min(stacked, (layer) => d3.min(layer, (d) => d[0]));
    const yMax = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1]));
    const yScale = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([dims.innerHeight, 0]);
    let xTickCount = getAdaptiveTickCount(dims.innerWidth);
    if (wideData.length < xTickCount) {
        xTickCount = wideData.length;
    }
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
    xAxis.selectAll('.tick text')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.15em')
        .attr('transform', 'rotate(-35)');
    if (offsetMode === 'expand') {
        const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
        const yAxis = g
            .append('g')
            .attr('class', 'y-axis')
            .call(d3
            .axisLeft(yScale)
            .ticks(yTickCount)
            .tickSize(-dims.innerWidth)
            .tickPadding(8)
            .tickFormat((d) => Math.round(d * 100) + '%'));
        styleAxis(yAxis);
    }
    const areaGen = d3
        .area()
        .x((d) => xScale(d.data._date))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(curve);
    const streams = g
        .selectAll('.stream')
        .data(stacked)
        .join('path')
        .attr('class', 'stream')
        .attr('d', areaGen)
        .attr('fill', (d) => colorScale(d.key))
        .attr('opacity', 0.85)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 0.5);
    if (interactive) {
        addStreamInteraction(g, streams, stacked, wideData, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, legendDiv, offsetMode);
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
function addStreamInteraction(g, streams, stacked, wideData, seriesNames, timeField, valueField, colorScale, xScale, yScale, dims, tooltip, legendDiv, offsetMode) {
    const sortedDates = wideData.map((d) => d._date.getTime());
    const crosshairLine = g
        .append('line')
        .attr('class', 'crosshair')
        .attr('y1', 0)
        .attr('y2', dims.innerHeight)
        .attr('stroke', TEXT_MUTED)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('pointer-events', 'none')
        .attr('opacity', 0);
    const highlightDots = g
        .append('g')
        .attr('class', 'highlight-dots')
        .attr('pointer-events', 'none');
    streams
        .attr('cursor', 'pointer')
        .on('mouseover', function (_event, d) {
        const hoveredKey = d.key;
        streams
            .attr('opacity', (s) => (s.key === hoveredKey ? 1 : 0.2))
            .attr('stroke-width', (s) => (s.key === hoveredKey ? 1.5 : 0.5));
        highlightLegendItem(legendDiv, hoveredKey);
    })
        .on('mousemove', function (event, d) {
        const [mx] = d3.pointer(event, g.node());
        const xDate = xScale.invert(mx).getTime();
        const hoveredKey = d.key;
        const bisect = d3.bisector((t) => t).left;
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
        const layer = stacked.find((l) => l.key === hoveredKey);
        if (layer) {
            const pt = layer[idx];
            const midY = yScale((pt[0] + pt[1]) / 2);
            highlightDots
                .append('circle')
                .attr('cx', nearestX)
                .attr('cy', midY)
                .attr('r', 5)
                .attr('fill', colorScale(hoveredKey))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
        }
        const dateStr = wideData[idx]._date.toLocaleDateString();
        const val = wideData[idx][hoveredKey] || 0;
        let html = `<strong>${hoveredKey}</strong><br/>`;
        html += `<span style="color:${TEXT_MUTED}">${dateStr}</span><br/>`;
        html += `${valueField}: ${formatValue(val)}`;
        if (offsetMode === 'expand') {
            const total = seriesNames.reduce((s, k) => s + (wideData[idx][k] || 0), 0);
            if (total > 0) {
                const pct = ((val / total) * 100).toFixed(1);
                html += ` (${pct}%)`;
            }
        }
        showTooltip(tooltip, html, event);
    })
        .on('mouseout', function () {
        streams.attr('opacity', 0.85).attr('stroke-width', 0.5);
        crosshairLine.attr('opacity', 0);
        highlightDots.selectAll('circle').remove();
        hideTooltip(tooltip);
        highlightLegendItem(legendDiv, null);
    });
    g.append('rect')
        .attr('class', 'hover-area')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .style('pointer-events', 'all')
        .lower()
        .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, g.node());
        const xDate = xScale.invert(mx).getTime();
        const bisect = d3.bisector((t) => t).left;
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
        const sorted = [...seriesNames]
            .map((name) => ({ name, value: wideData[idx][name] || 0 }))
            .sort((a, b) => b.value - a.value);
        sorted.forEach((s) => {
            const color = colorScale(s.name);
            html += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:5px;vertical-align:middle;"></span>${s.name}: ${formatValue(s.value)}`;
        });
        showTooltip(tooltip, html, event);
    })
        .on('mouseout', function () {
        crosshairLine.attr('opacity', 0);
        highlightDots.selectAll('circle').remove();
        hideTooltip(tooltip);
    });
}
//# sourceMappingURL=stream-graph.js.map