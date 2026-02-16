/**
 * Distribution renderers — histogram, beeswarm, strip-plot.
 */
import { createSvg, buildColorScale, drawXAxis, drawYAxis, drawLegend, createTooltip, showTooltip, hideTooltip, formatValue, DEFAULT_PALETTE, } from './shared.js';
// ─── HISTOGRAM ───────────────────────────────────────────────────────────────
export function renderHistogram(container, spec) {
    const { config, encoding, data } = spec;
    const xField = encoding.x?.field || 'binMid';
    const yField = encoding.y?.field || 'count';
    const { svg, g, dims } = createSvg(container, spec);
    const tooltip = createTooltip(container);
    // The histogram pattern pre-computes bins in data
    // Each row has binStart, binEnd, binMid, binLabel, count
    const hasBins = data[0]?.binStart !== undefined;
    if (hasBins) {
        // Pre-binned data from the histogram pattern
        const xScale = d3
            .scaleLinear()
            .domain([d3.min(data, (d) => d.binStart), d3.max(data, (d) => d.binEnd)])
            .range([0, dims.innerWidth]);
        const yScale = d3
            .scaleLinear()
            .domain([0, d3.max(data, (d) => d.count)])
            .range([dims.innerHeight, 0])
            .nice();
        drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title || config.sourceField);
        drawYAxis(g, yScale, dims.innerWidth, encoding.y?.title || 'Frequency');
        const binWidth = xScale(data[0].binEnd) - xScale(data[0].binStart);
        g.selectAll('.bar')
            .data(data)
            .join('rect')
            .attr('class', 'bar')
            .attr('x', (d) => xScale(d.binStart) + 1)
            .attr('y', dims.innerHeight)
            .attr('width', Math.max(binWidth - 2, 1))
            .attr('height', 0)
            .attr('fill', DEFAULT_PALETTE[0])
            .attr('opacity', 0.85)
            .attr('rx', 1)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 1).attr('fill', DEFAULT_PALETTE[2]);
            showTooltip(tooltip, `<strong>${d.binLabel}</strong><br/>Count: ${d.count}`, event);
        })
            .on('mousemove', (event) => {
            tooltip.style.left = event.clientX + 12 + 'px';
            tooltip.style.top = event.clientY - 12 + 'px';
        })
            .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.85).attr('fill', DEFAULT_PALETTE[0]);
            hideTooltip(tooltip);
        })
            .transition()
            .duration(600)
            .attr('y', (d) => yScale(d.count))
            .attr('height', (d) => dims.innerHeight - yScale(d.count));
        // Mean line
        if (config.showMean && config.mean != null) {
            const meanX = xScale(config.mean);
            g.append('line')
                .attr('x1', meanX)
                .attr('y1', 0)
                .attr('x2', meanX)
                .attr('y2', dims.innerHeight)
                .attr('stroke', '#f59e0b')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '6,3');
            g.append('text')
                .attr('x', meanX + 6)
                .attr('y', 14)
                .attr('fill', '#f59e0b')
                .attr('font-size', '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(`Mean: ${formatValue(config.mean)}`);
        }
        // Median line
        if (config.showMedian && config.median != null) {
            const medianX = xScale(config.median);
            g.append('line')
                .attr('x1', medianX)
                .attr('y1', 0)
                .attr('x2', medianX)
                .attr('y2', dims.innerHeight)
                .attr('stroke', '#10b981')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '3,3');
            g.append('text')
                .attr('x', medianX + 6)
                .attr('y', 30)
                .attr('fill', '#10b981')
                .attr('font-size', '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(`Median: ${formatValue(config.median)}`);
        }
    }
    else {
        // Raw data — compute bins
        const values = data.map((d) => Number(d[xField])).filter((v) => !isNaN(v));
        const binCount = config.binCount || Math.ceil(Math.log2(values.length) + 1);
        const xScale = d3
            .scaleLinear()
            .domain(d3.extent(values))
            .range([0, dims.innerWidth])
            .nice();
        const histogram = d3.bin().domain(xScale.domain()).thresholds(binCount);
        const bins = histogram(values);
        const yScale = d3
            .scaleLinear()
            .domain([0, d3.max(bins, (b) => b.length)])
            .range([dims.innerHeight, 0])
            .nice();
        drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title);
        drawYAxis(g, yScale, dims.innerWidth, 'Frequency');
        g.selectAll('.bar')
            .data(bins)
            .join('rect')
            .attr('class', 'bar')
            .attr('x', (d) => xScale(d.x0) + 1)
            .attr('y', dims.innerHeight)
            .attr('width', (d) => Math.max(xScale(d.x1) - xScale(d.x0) - 2, 1))
            .attr('height', 0)
            .attr('fill', DEFAULT_PALETTE[0])
            .attr('opacity', 0.85)
            .attr('rx', 1)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('opacity', 1).attr('fill', DEFAULT_PALETTE[2]);
            showTooltip(tooltip, `<strong>${d.x0.toFixed(1)} - ${d.x1.toFixed(1)}</strong><br/>Count: ${d.length}`, event);
        })
            .on('mousemove', (event) => {
            tooltip.style.left = event.clientX + 12 + 'px';
            tooltip.style.top = event.clientY - 12 + 'px';
        })
            .on('mouseout', function () {
            d3.select(this).attr('opacity', 0.85).attr('fill', DEFAULT_PALETTE[0]);
            hideTooltip(tooltip);
        })
            .transition()
            .duration(600)
            .attr('y', (d) => yScale(d.length))
            .attr('height', (d) => dims.innerHeight - yScale(d.length));
    }
}
// ─── BEESWARM ────────────────────────────────────────────────────────────────
export function renderBeeswarm(container, spec) {
    const { config, encoding, data } = spec;
    const valueField = config.valueField || encoding.x?.field;
    const groupField = config.groupField || encoding.y?.field || null;
    const dotRadius = config.dotRadius ?? 4;
    const opacity = config.opacity ?? 0.7;
    const { svg, g, dims } = createSvg(container, spec, { left: 80, bottom: 60 });
    const tooltip = createTooltip(container);
    const values = data.map((d) => Number(d[valueField]));
    const xScale = d3
        .scaleLinear()
        .domain(d3.extent(values))
        .range([0, dims.innerWidth])
        .nice();
    drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title || valueField);
    const colorScale = buildColorScale(encoding.color, data);
    if (groupField) {
        // Grouped beeswarm: each group on its own horizontal band
        const groups = [...new Set(data.map((d) => d[groupField]))];
        const yScale = d3.scaleBand().domain(groups).range([0, dims.innerHeight]).padding(0.1);
        drawYAxis(g, yScale, dims.innerWidth, encoding.y?.title || groupField);
        // Simulate beeswarm within each group band
        const bandHeight = yScale.bandwidth();
        groups.forEach((group) => {
            const groupData = data.filter((d) => d[groupField] === group);
            const bandMid = yScale(group) + bandHeight / 2;
            // Sort by value for deterministic layout
            groupData.sort((a, b) => Number(a[valueField]) - Number(b[valueField]));
            // Simple dodge algorithm: place dots in a grid-like pattern avoiding overlap
            const positions = dodgeBeeswarm(groupData.map((d) => xScale(Number(d[valueField]))), dotRadius * 2.2, bandHeight / 2 - dotRadius);
            g.selectAll(`.dot-${String(group).replace(/\s/g, '-')}`)
                .data(groupData)
                .join('circle')
                .attr('class', `dot-${String(group).replace(/\s/g, '-')}`)
                .attr('cx', (d) => xScale(Number(d[valueField])))
                .attr('cy', (_d, i) => bandMid + positions[i])
                .attr('r', 0)
                .attr('fill', (d) => colorScale(d[encoding.color?.field || groupField]))
                .attr('opacity', opacity)
                .attr('stroke', '#0f1117')
                .attr('stroke-width', 0.5)
                .on('mouseover', function (event, d) {
                d3.select(this).attr('r', dotRadius * 1.5).attr('opacity', 1);
                const fields = Object.entries(d)
                    .filter(([k]) => !k.startsWith('_'))
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('<br/>');
                showTooltip(tooltip, fields, event);
            })
                .on('mousemove', (event) => {
                tooltip.style.left = event.clientX + 12 + 'px';
                tooltip.style.top = event.clientY - 12 + 'px';
            })
                .on('mouseout', function () {
                d3.select(this).attr('r', dotRadius).attr('opacity', opacity);
                hideTooltip(tooltip);
            })
                .transition()
                .duration(600)
                .delay((_d, i) => i * 5)
                .attr('r', dotRadius);
        });
        // Median lines
        if (config.showMedianLine) {
            groups.forEach((group) => {
                const groupValues = data
                    .filter((d) => d[groupField] === group)
                    .map((d) => Number(d[valueField]))
                    .sort((a, b) => a - b);
                const median = groupValues[Math.floor(groupValues.length / 2)];
                const medianX = xScale(median);
                g.append('line')
                    .attr('x1', medianX)
                    .attr('y1', yScale(group))
                    .attr('x2', medianX)
                    .attr('y2', yScale(group) + bandHeight)
                    .attr('stroke', '#f59e0b')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4,3')
                    .attr('opacity', 0.6);
            });
        }
        drawLegend(svg, colorScale, dims);
    }
    else {
        // Single group: all dots centered vertically
        const sortedData = [...data].sort((a, b) => Number(a[valueField]) - Number(b[valueField]));
        const positions = dodgeBeeswarm(sortedData.map((d) => xScale(Number(d[valueField]))), dotRadius * 2.2, dims.innerHeight / 2 - dotRadius);
        const midY = dims.innerHeight / 2;
        g.selectAll('.dot')
            .data(sortedData)
            .join('circle')
            .attr('class', 'dot')
            .attr('cx', (d) => xScale(Number(d[valueField])))
            .attr('cy', (_d, i) => midY + positions[i])
            .attr('r', 0)
            .attr('fill', (d) => colorScale(d[encoding.color?.field || valueField]))
            .attr('opacity', opacity)
            .attr('stroke', '#0f1117')
            .attr('stroke-width', 0.5)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('r', dotRadius * 1.5).attr('opacity', 1);
            const fields = Object.entries(d)
                .filter(([k]) => !k.startsWith('_'))
                .map(([k, v]) => `${k}: ${v}`)
                .join('<br/>');
            showTooltip(tooltip, fields, event);
        })
            .on('mousemove', (event) => {
            tooltip.style.left = event.clientX + 12 + 'px';
            tooltip.style.top = event.clientY - 12 + 'px';
        })
            .on('mouseout', function () {
            d3.select(this).attr('r', dotRadius).attr('opacity', opacity);
            hideTooltip(tooltip);
        })
            .transition()
            .duration(600)
            .delay((_d, i) => i * 5)
            .attr('r', dotRadius);
    }
}
/**
 * Simple dodge algorithm for beeswarm layout.
 * Returns an array of y-offsets from center for each point.
 */
function dodgeBeeswarm(xPositions, spacing, maxOffset) {
    const offsets = new Array(xPositions.length).fill(0);
    const placed = [];
    for (let i = 0; i < xPositions.length; i++) {
        const x = xPositions[i];
        let bestY = 0;
        let found = false;
        // Try y = 0, then alternate +/- offsets
        for (let dy = 0; dy <= maxOffset; dy += spacing * 0.9) {
            for (const sign of dy === 0 ? [1] : [1, -1]) {
                const candidateY = sign * dy;
                const overlaps = placed.some((p) => Math.sqrt((p.x - x) ** 2 + (p.y - candidateY) ** 2) < spacing);
                if (!overlaps) {
                    bestY = candidateY;
                    found = true;
                    break;
                }
            }
            if (found)
                break;
        }
        offsets[i] = bestY;
        placed.push({ x, y: bestY });
    }
    return offsets;
}
// ─── STRIP PLOT ──────────────────────────────────────────────────────────────
export function renderStripPlot(container, spec) {
    const { config, encoding, data } = spec;
    const valueField = encoding.x?.field || Object.keys(data[0])[0];
    const groupField = encoding.y?.field || null;
    const { svg, g, dims } = createSvg(container, spec);
    const tooltip = createTooltip(container);
    const xScale = d3
        .scaleLinear()
        .domain(d3.extent(data, (d) => Number(d[valueField])))
        .range([0, dims.innerWidth])
        .nice();
    drawXAxis(g, xScale, dims.innerHeight, encoding.x?.title || valueField);
    const colorScale = buildColorScale(encoding.color, data);
    if (groupField) {
        const groups = [...new Set(data.map((d) => d[groupField]))];
        const yScale = d3.scaleBand().domain(groups).range([0, dims.innerHeight]).padding(0.2);
        drawYAxis(g, yScale, dims.innerWidth);
        g.selectAll('.dot')
            .data(data)
            .join('circle')
            .attr('class', 'dot')
            .attr('cx', (d) => xScale(Number(d[valueField])))
            .attr('cy', (d) => {
            const bandY = yScale(d[groupField]);
            const jitter = (Math.random() - 0.5) * yScale.bandwidth() * 0.7;
            return bandY + yScale.bandwidth() / 2 + jitter;
        })
            .attr('r', 3)
            .attr('fill', (d) => colorScale(d[encoding.color?.field || groupField]))
            .attr('opacity', 0.6)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('r', 6).attr('opacity', 1);
            showTooltip(tooltip, `${groupField}: ${d[groupField]}<br/>${valueField}: ${d[valueField]}`, event);
        })
            .on('mousemove', (event) => {
            tooltip.style.left = event.clientX + 12 + 'px';
            tooltip.style.top = event.clientY - 12 + 'px';
        })
            .on('mouseout', function () {
            d3.select(this).attr('r', 3).attr('opacity', 0.6);
            hideTooltip(tooltip);
        });
    }
    else {
        const midY = dims.innerHeight / 2;
        g.selectAll('.dot')
            .data(data)
            .join('circle')
            .attr('class', 'dot')
            .attr('cx', (d) => xScale(Number(d[valueField])))
            .attr('cy', () => midY + (Math.random() - 0.5) * dims.innerHeight * 0.6)
            .attr('r', 3)
            .attr('fill', (d) => colorScale(d[encoding.color?.field || valueField]))
            .attr('opacity', 0.6)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('r', 6).attr('opacity', 1);
            showTooltip(tooltip, `${valueField}: ${d[valueField]}`, event);
        })
            .on('mousemove', (event) => {
            tooltip.style.left = event.clientX + 12 + 'px';
            tooltip.style.top = event.clientY - 12 + 'px';
        })
            .on('mouseout', function () {
            d3.select(this).attr('r', 3).attr('opacity', 0.6);
            hideTooltip(tooltip);
        });
    }
}
//# sourceMappingURL=distribution.js.map