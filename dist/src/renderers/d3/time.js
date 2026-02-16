/**
 * Time renderers — line, small-multiples.
 */
import { createSvg, buildColorScale, drawXAxis, drawYAxis, drawLegend, createTooltip, showTooltip, hideTooltip, formatValue, DEFAULT_PALETTE, TEXT_COLOR, TEXT_MUTED, DARK_BG, } from './shared.js';
// ─── LINE CHART ──────────────────────────────────────────────────────────────
export function renderLine(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    const seriesField = config.seriesField || encoding.color?.field || null;
    const showPoints = config.showPoints ?? data.length <= 50;
    const showArea = config.showArea ?? false;
    const strokeWidth = config.strokeWidth ?? 2;
    const { svg, g, dims } = createSvg(container, spec, { right: seriesField ? 140 : 30 });
    const tooltip = createTooltip(container);
    // Parse dates
    const parseDate = (v) => {
        if (v instanceof Date)
            return v;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    };
    const parsedData = data
        .map((d) => ({
        ...d,
        _date: parseDate(d[timeField]),
        _value: Number(d[valueField]),
    }))
        .filter((d) => d._date !== null && !isNaN(d._value));
    // Scales
    const xExtent = d3.extent(parsedData, (d) => d._date);
    const xScale = d3.scaleTime().domain(xExtent).range([0, dims.innerWidth]).nice();
    const yExtent = d3.extent(parsedData, (d) => d._value);
    const yMin = showArea ? 0 : yExtent[0] * 0.9;
    const yScale = d3
        .scaleLinear()
        .domain([yMin, yExtent[1] * 1.05])
        .range([dims.innerHeight, 0])
        .nice();
    drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title);
    drawYAxis(g, yScale, dims.innerWidth, encoding.y?.title);
    // Interpolation
    const curveMap = {
        linear: d3.curveLinear,
        monotone: d3.curveMonotoneX,
        basis: d3.curveBasis,
        step: d3.curveStepAfter,
        cardinal: d3.curveCardinal,
        catmullRom: d3.curveCatmullRom,
    };
    const curve = curveMap[config.interpolation || 'monotone'] || d3.curveMonotoneX;
    const line = d3
        .line()
        .x((d) => xScale(d._date))
        .y((d) => yScale(d._value))
        .curve(curve);
    const area = d3
        .area()
        .x((d) => xScale(d._date))
        .y0(dims.innerHeight)
        .y1((d) => yScale(d._value))
        .curve(curve);
    const colorScale = buildColorScale(encoding.color, data);
    if (seriesField) {
        // Multi-series
        const seriesNames = [...new Set(parsedData.map((d) => d[seriesField]))];
        seriesNames.forEach((name) => {
            const seriesData = parsedData
                .filter((d) => d[seriesField] === name)
                .sort((a, b) => a._date.getTime() - b._date.getTime());
            const color = colorScale(name);
            // Area fill
            if (showArea) {
                g.append('path')
                    .datum(seriesData)
                    .attr('fill', color)
                    .attr('opacity', 0.1)
                    .attr('d', area);
            }
            // Line
            const path = g
                .append('path')
                .datum(seriesData)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', strokeWidth)
                .attr('d', line);
            // Animate line drawing
            const totalLength = path.node()?.getTotalLength?.() || 0;
            if (totalLength) {
                path
                    .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
                    .attr('stroke-dashoffset', totalLength)
                    .transition()
                    .duration(1000)
                    .attr('stroke-dashoffset', 0);
            }
            // Points
            if (showPoints) {
                g.selectAll(`.point-${String(name).replace(/\W/g, '')}`)
                    .data(seriesData)
                    .join('circle')
                    .attr('class', `point-${String(name).replace(/\W/g, '')}`)
                    .attr('cx', (d) => xScale(d._date))
                    .attr('cy', (d) => yScale(d._value))
                    .attr('r', 3)
                    .attr('fill', color)
                    .attr('stroke', DARK_BG)
                    .attr('stroke-width', 1.5)
                    .on('mouseover', function (event, d) {
                    d3.select(this).attr('r', 6);
                    showTooltip(tooltip, `<strong>${name}</strong><br/>${timeField}: ${d[timeField]}<br/>${valueField}: ${formatValue(d._value)}`, event);
                })
                    .on('mousemove', (event) => {
                    tooltip.style.left = event.clientX + 12 + 'px';
                    tooltip.style.top = event.clientY - 12 + 'px';
                })
                    .on('mouseout', function () {
                    d3.select(this).attr('r', 3);
                    hideTooltip(tooltip);
                });
            }
        });
        drawLegend(svg, colorScale, dims);
    }
    else {
        // Single series
        const sortedData = parsedData.sort((a, b) => a._date.getTime() - b._date.getTime());
        const color = DEFAULT_PALETTE[0];
        if (showArea) {
            g.append('path')
                .datum(sortedData)
                .attr('fill', color)
                .attr('opacity', 0.1)
                .attr('d', area);
        }
        const path = g
            .append('path')
            .datum(sortedData)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', strokeWidth)
            .attr('d', line);
        const totalLength = path.node()?.getTotalLength?.() || 0;
        if (totalLength) {
            path
                .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
                .attr('stroke-dashoffset', totalLength)
                .transition()
                .duration(1000)
                .attr('stroke-dashoffset', 0);
        }
        if (showPoints) {
            g.selectAll('.point')
                .data(sortedData)
                .join('circle')
                .attr('class', 'point')
                .attr('cx', (d) => xScale(d._date))
                .attr('cy', (d) => yScale(d._value))
                .attr('r', 3)
                .attr('fill', color)
                .attr('stroke', DARK_BG)
                .attr('stroke-width', 1.5)
                .on('mouseover', function (event, d) {
                d3.select(this).attr('r', 6);
                showTooltip(tooltip, `${timeField}: ${d[timeField]}<br/>${valueField}: ${formatValue(d._value)}`, event);
            })
                .on('mousemove', (event) => {
                tooltip.style.left = event.clientX + 12 + 'px';
                tooltip.style.top = event.clientY - 12 + 'px';
            })
                .on('mouseout', function () {
                d3.select(this).attr('r', 3);
                hideTooltip(tooltip);
            });
        }
    }
}
// ─── SMALL MULTIPLES ─────────────────────────────────────────────────────────
export function renderSmallMultiples(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    const seriesField = config.seriesField || encoding.color?.field;
    if (!seriesField) {
        // Fall back to regular line chart if no series field
        return renderLine(container, spec);
    }
    const seriesNames = [...new Set(data.map((d) => d[seriesField]))];
    const cols = Math.ceil(Math.sqrt(seriesNames.length));
    const rows = Math.ceil(seriesNames.length / cols);
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const cellW = width / cols;
    const cellH = height / rows;
    const cellMargin = { top: 24, right: 10, bottom: 20, left: 40 };
    const innerCellW = cellW - cellMargin.left - cellMargin.right;
    const innerCellH = cellH - cellMargin.top - cellMargin.bottom;
    const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', DARK_BG)
        .style('border-radius', '8px');
    // Title
    if (spec.title) {
        svg
            .append('text')
            .attr('x', width / 2)
            .attr('y', 16)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_COLOR)
            .attr('font-size', '13px')
            .attr('font-weight', '600')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(spec.title);
    }
    // Parse dates
    const parseDate = (v) => {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    };
    // Global scales for consistency
    const allDates = data.map((d) => parseDate(d[timeField])).filter(Boolean);
    const allValues = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
    const xDomain = d3.extent(allDates);
    const yDomain = [0, d3.max(allValues)];
    const colorScale = buildColorScale(encoding.color, data);
    seriesNames.forEach((name, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const offsetX = col * cellW + cellMargin.left;
        const offsetY = row * cellH + cellMargin.top + (spec.title ? 10 : 0);
        const cellG = svg.append('g').attr('transform', `translate(${offsetX},${offsetY})`);
        const xScale = d3.scaleTime().domain(xDomain).range([0, innerCellW]);
        const yScale = d3.scaleLinear().domain(yDomain).range([innerCellH, 0]);
        // Mini axes
        cellG
            .append('g')
            .attr('transform', `translate(0,${innerCellH})`)
            .call(d3.axisBottom(xScale).ticks(3).tickSize(0))
            .selectAll('text')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '8px');
        cellG
            .append('g')
            .call(d3.axisLeft(yScale).ticks(3).tickSize(0))
            .selectAll('text')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '8px');
        // Remove domain lines
        cellG.selectAll('.domain').remove();
        // Series label
        cellG
            .append('text')
            .attr('x', innerCellW / 2)
            .attr('y', -8)
            .attr('text-anchor', 'middle')
            .attr('fill', colorScale(name))
            .attr('font-size', '11px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(String(name));
        // Data for this series
        const seriesData = data
            .filter((d) => d[seriesField] === name)
            .map((d) => ({ ...d, _date: parseDate(d[timeField]), _value: Number(d[valueField]) }))
            .filter((d) => d._date !== null)
            .sort((a, b) => a._date.getTime() - b._date.getTime());
        const line = d3
            .line()
            .x((d) => xScale(d._date))
            .y((d) => yScale(d._value))
            .curve(d3.curveMonotoneX);
        // Area
        const area = d3
            .area()
            .x((d) => xScale(d._date))
            .y0(innerCellH)
            .y1((d) => yScale(d._value))
            .curve(d3.curveMonotoneX);
        cellG
            .append('path')
            .datum(seriesData)
            .attr('fill', colorScale(name))
            .attr('opacity', 0.08)
            .attr('d', area);
        cellG
            .append('path')
            .datum(seriesData)
            .attr('fill', 'none')
            .attr('stroke', colorScale(name))
            .attr('stroke-width', 1.5)
            .attr('d', line);
    });
}
//# sourceMappingURL=time.js.map