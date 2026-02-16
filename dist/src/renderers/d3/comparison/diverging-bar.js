/**
 * Diverging bar chart D3 renderer with adaptive sizing, smart hover targets,
 * and value labels — following the same standards as the bar chart renderer.
 */
import { createSvg, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, styleAxis, getAdaptiveTickCount, calculateLeftMargin, shouldRotateLabels, calculateBottomMargin, truncateLabel, shouldShowValueLabels, renderEmptyState, isAllZeros, TEXT_MUTED, AXIS_COLOR, } from '../shared.js';
// ─── MAIN ENTRY ──────────────────────────────────────────────────────────────
export function renderDivergingBar(container, spec) {
    const { encoding, data, config } = spec;
    const orientation = config?.orientation === 'vertical' ? 'vertical' : 'horizontal';
    // Spec always maps: encoding.x = value (quantitative), encoding.y = category (nominal)
    // Both render functions expect: param1 = categoryField, param2 = valueField
    const valueField = encoding.x?.field || Object.keys(data[0])[1];
    const categoryField = encoding.y?.field || Object.keys(data[0])[0];
    if (orientation === 'vertical') {
        renderVertical(container, spec, categoryField, valueField);
    }
    else {
        renderHorizontal(container, spec, categoryField, valueField);
    }
}
// ─── HORIZONTAL (categories top-to-bottom, bars left-to-right) ───────────────
function renderHorizontal(container, spec, xField, yField) {
    const { encoding, data, config } = spec;
    const categories = data.map((d) => String(d[xField]));
    // Dynamic left margin based on label lengths
    const leftMargin = calculateLeftMargin(categories);
    const { svg, g, dims } = createSvg(container, spec, { left: leftMargin, bottom: 40 });
    const tooltip = createTooltip(container);
    // Check if all values are zero
    if (isAllZeros(data, yField)) {
        renderEmptyState(g, dims);
        return;
    }
    const yScale = d3.scaleBand().domain(categories).range([0, dims.innerHeight]).padding(0.2);
    const values = data.map((d) => Number(d[yField]));
    const maxAbs = Math.max(Math.abs(d3.min(values)), Math.abs(d3.max(values)));
    const xScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, dims.innerWidth]).nice();
    const midX = xScale(0);
    // Adaptive tick count for x-axis
    const xTickCount = getAdaptiveTickCount(dims.innerWidth);
    // X axis (values) at bottom with adaptive ticks + formatted values
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3.axisBottom(xScale)
        .ticks(xTickCount)
        .tickSize(-dims.innerHeight)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(xAxis);
    // Y axis (categories) with truncated labels
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale)
        .tickSize(0)
        .tickPadding(10)
        .tickFormat((d) => truncateLabel(d, 25)));
    styleAxis(yAxis);
    // Center line at zero
    g.append('line')
        .attr('x1', midX)
        .attr('y1', 0)
        .attr('x2', midX)
        .attr('y2', dims.innerHeight)
        .attr('stroke', AXIS_COLOR)
        .attr('stroke-width', 1.5);
    // Clamp bar height for single/few items
    const maxBarHeight = Math.min(80, dims.innerHeight * 0.3);
    const barHeight = Math.min(yScale.bandwidth(), maxBarHeight);
    const barYOffset = (yScale.bandwidth() - barHeight) / 2;
    // Invisible hover targets (full-width for easy hovering)
    g.selectAll('.bar-hover-target')
        .data(data)
        .join('rect')
        .attr('class', 'bar-hover-target')
        .attr('y', (d) => yScale(String(d[xField])))
        .attr('x', 0)
        .attr('height', yScale.bandwidth())
        .attr('width', dims.innerWidth)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        g.selectAll('.bar')
            .filter((bd) => bd[xField] === d[xField])
            .attr('opacity', 0.8);
        const val = Number(d[yField]);
        showTooltip(tooltip, `<strong>${d[xField]}</strong><br/>${yField}: ${val >= 0 ? '+' : ''}${formatValue(val)}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.bar').attr('opacity', 1);
        hideTooltip(tooltip);
    });
    // Draw bars (pointer-events: none — hover targets handle interaction)
    g.selectAll('.bar')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('y', (d) => yScale(String(d[xField])) + barYOffset)
        .attr('height', barHeight)
        .attr('x', (d) => {
        const val = Number(d[yField]);
        return val >= 0 ? midX : xScale(val);
    })
        .attr('width', (d) => Math.max(2, Math.abs(xScale(Number(d[yField])) - midX)))
        .attr('fill', (d) => (Number(d[yField]) >= 0 ? '#10b981' : '#ef4444'))
        .attr('rx', 3)
        .attr('pointer-events', 'none');
    // Value labels on bars (auto-enabled for large enough bars)
    const showLabels = shouldShowValueLabels(config, barHeight, true);
    if (showLabels) {
        g.selectAll('.bar-label')
            .data(data)
            .join('text')
            .attr('class', 'bar-label')
            .attr('y', (d) => yScale(String(d[xField])) + yScale.bandwidth() / 2)
            .attr('x', (d) => {
            const val = Number(d[yField]);
            const barEnd = xScale(val);
            const barWidth = Math.abs(barEnd - midX);
            // Place inside bar if wide enough, otherwise outside
            if (val >= 0) {
                return barWidth > 50 ? barEnd - 5 : barEnd + 5;
            }
            else {
                return barWidth > 50 ? barEnd + 5 : barEnd - 5;
            }
        })
            .attr('text-anchor', (d) => {
            const val = Number(d[yField]);
            const barWidth = Math.abs(xScale(val) - midX);
            if (val >= 0)
                return barWidth > 50 ? 'end' : 'start';
            return barWidth > 50 ? 'start' : 'end';
        })
            .attr('dominant-baseline', 'middle')
            .attr('fill', (d) => {
            const barWidth = Math.abs(xScale(Number(d[yField])) - midX);
            return barWidth > 50 ? '#ffffff' : TEXT_MUTED;
        })
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .style('opacity', 1)
            .text((d) => {
            const val = Number(d[yField]);
            return (val >= 0 ? '+' : '') + formatValue(val);
        });
    }
}
// ─── VERTICAL (categories left-to-right, bars up-to-down) ────────────────────
function renderVertical(container, spec, xField, yField) {
    const { encoding, data, config } = spec;
    const categories = data.map((d) => String(d[xField]));
    // Pre-calculate label rotation and dynamic bottom margin
    const containerWidth = container.clientWidth || 800;
    const estimatedBarWidth = (containerWidth - 140) / categories.length;
    const willRotate = shouldRotateLabels(categories, estimatedBarWidth);
    const bottomMargin = calculateBottomMargin(categories, willRotate);
    const { svg, g, dims } = createSvg(container, spec, { bottom: bottomMargin, left: 70 });
    const tooltip = createTooltip(container);
    // Check if all values are zero
    if (isAllZeros(data, yField)) {
        renderEmptyState(g, dims);
        return;
    }
    const xScale = d3.scaleBand().domain(categories).range([0, dims.innerWidth]).padding(0.2);
    const values = data.map((d) => Number(d[yField]));
    const maxAbs = Math.max(Math.abs(d3.min(values)), Math.abs(d3.max(values)));
    const yScale = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([dims.innerHeight, 0]).nice();
    const midY = yScale(0);
    // X axis (categories) at bottom with truncated labels
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3.axisBottom(xScale)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat((d) => truncateLabel(d, 25)));
    styleAxis(xAxis);
    // Smart label rotation based on bar width and label length
    const barWidth = xScale.bandwidth();
    const needsRotation = shouldRotateLabels(categories, barWidth);
    if (needsRotation) {
        g.selectAll('.x-axis .tick text')
            .attr('transform', 'rotate(-35)')
            .attr('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.15em');
    }
    // Adaptive tick count for y-axis
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
    // Y axis (values) with adaptive ticks, grid lines, formatted values
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(yAxis);
    // Center line at zero (stronger weight to stand out from grid)
    g.append('line')
        .attr('x1', 0)
        .attr('y1', midY)
        .attr('x2', dims.innerWidth)
        .attr('y2', midY)
        .attr('stroke', AXIS_COLOR)
        .attr('stroke-width', 1.5);
    // Clamp bar width for single/few items
    const maxBarWidth = Math.min(80, dims.innerWidth * 0.3);
    const clampedBarWidth = Math.min(xScale.bandwidth(), maxBarWidth);
    const barXOffset = (xScale.bandwidth() - clampedBarWidth) / 2;
    // Invisible hover targets (full-height for easy hovering)
    g.selectAll('.bar-hover-target')
        .data(data)
        .join('rect')
        .attr('class', 'bar-hover-target')
        .attr('x', (d) => xScale(String(d[xField])))
        .attr('y', 0)
        .attr('width', xScale.bandwidth())
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'pointer')
        .on('mouseover', function (event, d) {
        g.selectAll('.bar')
            .filter((bd) => bd[xField] === d[xField])
            .attr('opacity', 0.8);
        const val = Number(d[yField]);
        showTooltip(tooltip, `<strong>${d[xField]}</strong><br/>${yField}: ${val >= 0 ? '+' : ''}${formatValue(val)}`, event);
    })
        .on('mousemove', (event) => {
        positionTooltip(tooltip, event);
    })
        .on('mouseout', function () {
        g.selectAll('.bar').attr('opacity', 1);
        hideTooltip(tooltip);
    });
    // Draw bars (pointer-events: none — hover targets handle interaction)
    g.selectAll('.bar')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d) => xScale(String(d[xField])) + barXOffset)
        .attr('width', clampedBarWidth)
        .attr('y', (d) => {
        const val = Number(d[yField]);
        return val >= 0 ? yScale(val) : midY;
    })
        .attr('height', (d) => Math.max(2, Math.abs(yScale(Number(d[yField])) - midY)))
        .attr('fill', (d) => (Number(d[yField]) >= 0 ? '#10b981' : '#ef4444'))
        .attr('rx', 3)
        .attr('pointer-events', 'none');
    // Value labels on bars (auto-enabled for wide enough bars)
    const showLabels = shouldShowValueLabels(config, clampedBarWidth, false);
    if (showLabels) {
        g.selectAll('.bar-label')
            .data(data)
            .join('text')
            .attr('class', 'bar-label')
            .attr('x', (d) => xScale(String(d[xField])) + xScale.bandwidth() / 2)
            .attr('y', (d) => {
            const val = Number(d[yField]);
            const barHeight = Math.abs(yScale(val) - midY);
            if (val >= 0) {
                // Positive bar: label above if short, inside top if tall
                return barHeight < 20 ? yScale(val) - 6 : yScale(val) + 14;
            }
            else {
                // Negative bar: label below if short, inside bottom if tall
                return barHeight < 20 ? midY + barHeight + 14 : midY + barHeight - 6;
            }
        })
            .attr('text-anchor', 'middle')
            .attr('fill', (d) => {
            const barHeight = Math.abs(yScale(Number(d[yField])) - midY);
            return barHeight < 20 ? TEXT_MUTED : '#ffffff';
        })
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .style('opacity', 1)
            .text((d) => {
            const val = Number(d[yField]);
            return (val >= 0 ? '+' : '') + formatValue(val);
        });
    }
}
//# sourceMappingURL=diverging-bar.js.map