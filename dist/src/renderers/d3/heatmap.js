/**
 * Heatmap (Matrix) renderer — two categorical axes with color-encoded cells.
 *
 * Best for correlation matrices, cross-tabulation, frequency matrices,
 * and any 2D categorical × numeric dataset.
 */
import { createSvg, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, contrastText, truncateLabel, calculateLeftMargin, calculateBottomMargin, shouldRotateLabels, DARK_BG, TEXT_MUTED, } from './shared.js';
import { sequential, diverging } from '../../theme/colors.js';
export function renderHeatmap(container, spec) {
    const { config, encoding, data } = spec;
    const rowField = config.rowField || encoding.y?.field || Object.keys(data[0])[0];
    const colField = config.colField || encoding.x?.field || Object.keys(data[0])[1];
    const valueField = config.valueField || encoding.color?.field || Object.keys(data[0])[2];
    let rows = [...new Set(data.map((d) => d[rowField]))];
    let cols = [...new Set(data.map((d) => d[colField]))];
    if (config.sortRows === 'ascending')
        rows.sort((a, b) => String(a).localeCompare(String(b)));
    if (config.sortRows === 'descending')
        rows.sort((a, b) => String(b).localeCompare(String(a)));
    if (config.sortCols === 'ascending')
        cols.sort((a, b) => String(a).localeCompare(String(b)));
    if (config.sortCols === 'descending')
        cols.sort((a, b) => String(b).localeCompare(String(a)));
    const rowLabels = rows.map((r) => String(r));
    const colLabels = cols.map((c) => String(c));
    const leftMargin = calculateLeftMargin(rowLabels);
    const colBandEstimate = (container.clientWidth || 800) / Math.max(cols.length, 1);
    const rotateColLabels = shouldRotateLabels(colLabels, colBandEstimate);
    const bottomMargin = calculateBottomMargin(colLabels, rotateColLabels);
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'flex: 1; min-height: 0;';
    container.appendChild(chartWrapper);
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        left: leftMargin,
        bottom: bottomMargin,
    });
    const tooltip = createTooltip(container);
    const xScale = d3.scaleBand().domain(cols).range([0, dims.innerWidth]).padding(0);
    const yScale = d3.scaleBand().domain(rows).range([0, dims.innerHeight]).padding(0);
    const values = data.map((d) => Number(d[valueField]));
    const extent = d3.extent(values);
    if (values.every((v) => isNaN(v))) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = `display:flex;align-items:center;justify-content:center;height:100%;color:${TEXT_MUTED};font-size:14px;font-family:Inter,system-ui,sans-serif;background:${DARK_BG};border-radius:8px;`;
        emptyDiv.textContent = 'No numeric column for color encoding';
        container.innerHTML = '';
        container.appendChild(emptyDiv);
        return;
    }
    let colorScale;
    const palette = encoding.color?.palette;
    if (palette && ['blueRed', 'greenPurple', 'tealOrange', 'redGreen'].includes(palette)) {
        const colors = diverging[palette];
        if (colors) {
            const maxAbs = Math.max(Math.abs(extent[0]), Math.abs(extent[1])) || 1;
            const mid = Math.floor(colors.length / 2);
            colorScale = d3
                .scaleLinear()
                .domain([-maxAbs, 0, maxAbs])
                .range([colors[0], colors[mid], colors[colors.length - 1]])
                .interpolate(d3.interpolateRgb)
                .clamp(true);
        }
    }
    if (!colorScale && palette && ['blue', 'green', 'purple', 'warm'].includes(palette)) {
        const colors = sequential[palette];
        if (colors) {
            colorScale = d3
                .scaleLinear()
                .domain(extent)
                .range([colors[0], colors[colors.length - 1]])
                .interpolate(d3.interpolateRgb);
        }
    }
    if (!colorScale) {
        const hasMixedSign = extent[0] < 0 && extent[1] > 0;
        const allNegative = extent[1] <= 0 && extent[0] < 0;
        if (hasMixedSign) {
            const colors = diverging.blueRed;
            const maxAbs = Math.max(Math.abs(extent[0]), Math.abs(extent[1])) || 1;
            const mid = Math.floor(colors.length / 2);
            colorScale = d3
                .scaleLinear()
                .domain([-maxAbs, 0, maxAbs])
                .range([colors[0], colors[mid], colors[colors.length - 1]])
                .interpolate(d3.interpolateRgb)
                .clamp(true);
        }
        else if (allNegative) {
            const warmStops = sequential.warm;
            colorScale = d3
                .scaleLinear()
                .domain([extent[0], extent[1]])
                .range([warmStops[1], warmStops[7]])
                .interpolate(d3.interpolateRgb)
                .clamp(true);
        }
        else {
            const goldStops = ['#2a1f0e', '#4a3520', '#7a5c2e', '#b8860b', '#c9a84c', '#dbc67e', '#f0e4b5'];
            const t = d3.scaleLinear().domain([0, goldStops.length - 1]).range(extent);
            const stopDomain = goldStops.map((_, i) => t(i));
            colorScale = d3
                .scaleLinear()
                .domain(stopDomain)
                .range(goldStops)
                .interpolate(d3.interpolateRgb)
                .clamp(true);
        }
    }
    const lookup = new Map();
    for (const d of data) {
        lookup.set(`${d[rowField]}__${d[colField]}`, Number(d[valueField]));
    }
    const cellWidth = xScale.bandwidth();
    const cellHeight = yScale.bandwidth();
    const showValues = config.showValues ?? (cellWidth >= 30 && cellHeight >= 20);
    g.selectAll('.heatmap-cell')
        .data(data)
        .join('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', (d) => xScale(d[colField]))
        .attr('y', (d) => yScale(d[rowField]))
        .attr('width', cellWidth)
        .attr('height', cellHeight)
        .attr('fill', (d) => colorScale(Number(d[valueField])))
        .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        const html = `<strong>${rowField}:</strong> ${d[rowField]}<br/><strong>${colField}:</strong> ${d[colField]}<br/><strong>${valueField}:</strong> ${formatValue(Number(d[valueField]))}`;
        showTooltip(tooltip, html, event);
    })
        .on('mousemove', function (event) {
        positionTooltip(tooltip, event);
    })
        .on('mouseleave', function () {
        d3.select(this).attr('opacity', 1);
        hideTooltip(tooltip);
    });
    // Grid lines on top of cells
    rows.forEach((row) => {
        g.append('line')
            .attr('x1', 0).attr('x2', dims.innerWidth)
            .attr('y1', yScale(row)).attr('y2', yScale(row))
            .attr('stroke', '#000').attr('stroke-width', 0.5).attr('pointer-events', 'none');
    });
    g.append('line')
        .attr('x1', 0).attr('x2', dims.innerWidth)
        .attr('y1', dims.innerHeight).attr('y2', dims.innerHeight)
        .attr('stroke', '#000').attr('stroke-width', 0.5).attr('pointer-events', 'none');
    cols.forEach((col) => {
        g.append('line')
            .attr('x1', xScale(col)).attr('x2', xScale(col))
            .attr('y1', 0).attr('y2', dims.innerHeight)
            .attr('stroke', '#000').attr('stroke-width', 0.5).attr('pointer-events', 'none');
    });
    g.append('line')
        .attr('x1', dims.innerWidth).attr('x2', dims.innerWidth)
        .attr('y1', 0).attr('y2', dims.innerHeight)
        .attr('stroke', '#000').attr('stroke-width', 0.5).attr('pointer-events', 'none');
    if (showValues) {
        const fontSize = Math.min(11, Math.max(8, Math.min(cellWidth, cellHeight) * 0.35));
        g.selectAll('.cell-label')
            .data(data)
            .join('text')
            .attr('class', 'cell-label')
            .attr('x', (d) => xScale(d[colField]) + cellWidth / 2)
            .attr('y', (d) => yScale(d[rowField]) + cellHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('fill', (d) => contrastText(colorScale(Number(d[valueField]))))
            .attr('font-size', `${fontSize}px`)
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text((d) => formatValue(Number(d[valueField])));
    }
    // Adaptive label thinning: show every Nth label when too many
    const maxRowLabels = Math.max(1, Math.floor(dims.innerHeight / 14));
    const rowLabelStep = rows.length > maxRowLabels ? Math.ceil(rows.length / maxRowLabels) : 1;
    const rowTickValues = rowLabelStep > 1 ? rows.filter((_, i) => i % rowLabelStep === 0) : rows;
    const maxColLabels = Math.max(1, Math.floor(dims.innerWidth / 30));
    const colLabelStep = cols.length > maxColLabels ? Math.ceil(cols.length / maxColLabels) : 1;
    const colTickValues = colLabelStep > 1 ? cols.filter((_, i) => i % colLabelStep === 0) : cols;
    // Y axis (row labels)
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(6).tickValues(rowTickValues));
    yAxis.select('.domain').remove();
    yAxis
        .selectAll('.tick text')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(function () {
        return truncateLabel(d3.select(this).text(), 20);
    });
    // X axis (column labels)
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(8).tickValues(colTickValues));
    xAxis.select('.domain').remove();
    xAxis
        .selectAll('.tick text')
        .attr('fill', TEXT_MUTED)
        .attr('font-size', '11px')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text(function () {
        return truncateLabel(d3.select(this).text(), 16);
    });
    if (rotateColLabels) {
        xAxis
            .selectAll('.tick text')
            .attr('text-anchor', 'end')
            .attr('transform', 'rotate(-35)')
            .attr('dx', '-0.5em')
            .attr('dy', '0.3em');
    }
    // HTML color legend below the SVG
    const legendDiv = document.createElement('div');
    legendDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 10px 4px; font-family: Inter, system-ui, sans-serif; font-size: 10px; color: #9ca3af;';
    const minLabel = document.createElement('span');
    minLabel.textContent = formatValue(extent[0]);
    const gradBar = document.createElement('div');
    gradBar.style.cssText = 'width: 160px; height: 10px; border-radius: 3px;';
    const stops = [];
    for (let i = 0; i <= 10; i++) {
        const val = extent[0] + (i / 10) * (extent[1] - extent[0]);
        stops.push(colorScale(val));
    }
    gradBar.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
    const maxLabel = document.createElement('span');
    maxLabel.textContent = formatValue(extent[1]);
    legendDiv.appendChild(minLabel);
    legendDiv.appendChild(gradBar);
    legendDiv.appendChild(maxLabel);
    container.appendChild(legendDiv);
}
//# sourceMappingURL=heatmap.js.map