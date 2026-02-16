/**
 * Small multiples D3 renderer.
 */
import { buildColorScale, TEXT_COLOR, TEXT_MUTED, DARK_BG, truncateTitle, } from '../shared.js';
import { renderLine } from './line.js';
export function renderSmallMultiples(container, spec) {
    const { config, encoding, data } = spec;
    const timeField = config.timeField || encoding.x?.field;
    const valueField = config.valueField || encoding.y?.field;
    const seriesField = config.seriesField || encoding.color?.field;
    if (!seriesField) {
        return renderLine(container, spec);
    }
    const seriesNames = [...new Set(data.map((d) => d[seriesField]))];
    const cols = Math.ceil(Math.sqrt(seriesNames.length));
    const rows = Math.ceil(seriesNames.length / cols);
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const titleReserve = spec.title ? 28 : 0;
    const cellW = width / cols;
    const cellH = (height - titleReserve) / rows;
    const cellMargin = { top: 18, right: 20, bottom: 20, left: 40 };
    const innerCellW = cellW - cellMargin.left - cellMargin.right;
    const innerCellH = cellH - cellMargin.top - cellMargin.bottom;
    const svg = d3
        .select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .style('background', DARK_BG)
        .style('border-radius', '8px');
    if (spec.title) {
        const titleEl = svg
            .append('text')
            .attr('x', width / 2)
            .attr('y', 16)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_COLOR)
            .attr('font-size', '13px')
            .attr('font-weight', '600')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(spec.title);
        truncateTitle(titleEl, spec.title, width - 20);
    }
    // Global scales for consistency
    const allDates = data.map((d) => parseDate(d[timeField])).filter(Boolean);
    const allValues = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
    const xDomain = d3.extent(allDates);
    const yDomain = [Math.min(0, d3.min(allValues)), d3.max(allValues)];
    // Check if all values are zero
    if (allValues.every(v => v === 0)) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '14px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text('All values are zero');
        return;
    }
    const colorScale = buildColorScale(encoding.color, data);
    seriesNames.forEach((name, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const offsetX = col * cellW + cellMargin.left;
        const offsetY = row * cellH + cellMargin.top + titleReserve;
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
        cellG.selectAll('.domain').remove();
        // Series label — truncated to fit within cell
        const maxLabelChars = Math.max(5, Math.floor(innerCellW / 6));
        const seriesLabel = String(name);
        const truncatedLabel = seriesLabel.length > maxLabelChars
            ? seriesLabel.slice(0, maxLabelChars - 1) + '\u2026'
            : seriesLabel;
        cellG
            .append('text')
            .attr('x', innerCellW / 2)
            .attr('y', -4)
            .attr('text-anchor', 'middle')
            .attr('fill', colorScale(name))
            .attr('font-size', '11px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(truncatedLabel);
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
        const area = d3
            .area()
            .x((d) => xScale(d._date))
            .y0(yScale(0))
            .y1((d) => yScale(d._value))
            .curve(d3.curveMonotoneX);
        if (seriesData.length <= 1 && seriesData.length > 0) {
            const d = seriesData[0];
            cellG.append('circle')
                .attr('cx', xScale(d._date))
                .attr('cy', yScale(d._value))
                .attr('r', 5)
                .attr('fill', colorScale(name))
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5);
            cellG.append('text')
                .attr('x', xScale(d._date))
                .attr('y', yScale(d._value) - 10)
                .attr('text-anchor', 'middle')
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '9px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(d._value);
        }
        else {
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
        }
    });
}
function parseDate(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
//# sourceMappingURL=small-multiples.js.map