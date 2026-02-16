/**
 * Density plot D3 renderer.
 *
 * Draws smooth KDE (kernel density estimation) curves for continuous data.
 * Supports single distribution or 2-4 overlapping group distributions.
 * Optional rug plot ticks on the x-axis show individual data points.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, createLegend, formatValue, TEXT_MUTED, styleAxis, getAdaptiveTickCount, } from '../shared.js';
import { categorical } from '../../../theme/colors.js';
// ─── KDE HELPERS ──────────────────────────────────────────────────────────────
/** Gaussian kernel function. */
function gaussianKernel(u) {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}
/** Compute standard deviation of a numeric array. */
function stdDev(values) {
    const n = values.length;
    if (n < 2)
        return 1;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    return Math.sqrt(variance);
}
/** Silverman's rule of thumb for bandwidth selection. */
function silvermanBandwidth(values) {
    const sd = stdDev(values);
    const n = values.length;
    if (sd === 0)
        return 1;
    return 1.06 * sd * Math.pow(n, -0.2);
}
/** Compute KDE for a set of values at the given sample points. */
function computeKDE(values, samplePoints, bandwidth) {
    const n = values.length;
    if (n === 0)
        return samplePoints.map((x) => [x, 0]);
    return samplePoints.map((x) => {
        const density = values.reduce((sum, xi) => sum + gaussianKernel((x - xi) / bandwidth), 0) /
            (n * bandwidth);
        return [x, density];
    });
}
// ─── DENSITY PLOT RENDERER ────────────────────────────────────────────────────
export function renderDensityPlot(container, spec) {
    const { config, encoding, data } = spec;
    const valueField = config.valueField || encoding.x?.field || Object.keys(data[0]).find((k) => typeof data[0][k] === 'number') || Object.keys(data[0])[0];
    const categoryField = config.categoryField || encoding.color?.field || null;
    const filled = config.filled ?? true;
    const showRug = config.showRug ?? false;
    const userBandwidth = typeof config.bandwidth === 'number' ? config.bandwidth : undefined;
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'flex: 1; min-height: 0;';
    container.appendChild(chartWrapper);
    const bottomMargin = showRug ? 65 : 50;
    const { svg, g, dims } = createSvg(chartWrapper, spec, { bottom: bottomMargin, left: 60 });
    const tooltip = createTooltip(container);
    const allValues = data
        .map((d) => Number(d[valueField]))
        .filter((v) => !isNaN(v) && isFinite(v));
    if (allValues.length === 0) {
        g.append('text')
            .attr('x', dims.innerWidth / 2)
            .attr('y', dims.innerHeight / 2)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '14px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text('No numeric data available');
        return;
    }
    const xExtent = d3.extent(allValues);
    const xRange = xExtent[1] - xExtent[0];
    const xPad = xRange * 0.1 || 1;
    const xScale = d3
        .scaleLinear()
        .domain([xExtent[0] - xPad, xExtent[1] + xPad])
        .range([0, dims.innerWidth])
        .nice();
    const sampleCount = 200;
    const xDomain = xScale.domain();
    const step = (xDomain[1] - xDomain[0]) / (sampleCount - 1);
    const samplePoints = Array.from({ length: sampleCount }, (_, i) => xDomain[0] + i * step);
    let groups = [];
    let groupDataMap = new Map();
    let groupDensities = new Map();
    let maxDensity = 0;
    if (categoryField) {
        groups = [...new Set(data.map((d) => String(d[categoryField])))];
        groups.forEach((group) => {
            const vals = data
                .filter((d) => String(d[categoryField]) === group)
                .map((d) => Number(d[valueField]))
                .filter((v) => !isNaN(v) && isFinite(v));
            groupDataMap.set(group, vals);
            const bw = userBandwidth || silvermanBandwidth(vals);
            const density = computeKDE(vals, samplePoints, bw);
            groupDensities.set(group, density);
            const localMax = d3.max(density, (d) => d[1]) || 0;
            if (localMax > maxDensity)
                maxDensity = localMax;
        });
    }
    else {
        groups = ['_all'];
        groupDataMap.set('_all', allValues);
        const bw = userBandwidth || silvermanBandwidth(allValues);
        const density = computeKDE(allValues, samplePoints, bw);
        groupDensities.set('_all', density);
        maxDensity = d3.max(density, (d) => d[1]) || 0;
    }
    if (maxDensity === 0)
        maxDensity = 1;
    const yScale = d3
        .scaleLinear()
        .domain([0, maxDensity * 1.08])
        .range([dims.innerHeight, 0])
        .nice();
    const xTickCount = getAdaptiveTickCount(dims.innerWidth);
    const xAxis = g
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${dims.innerHeight})`)
        .call(d3
        .axisBottom(xScale)
        .ticks(xTickCount)
        .tickSize(-dims.innerHeight)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(xAxis);
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 50);
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3
        .axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8)
        .tickFormat((d) => {
        if (d === 0)
            return '0';
        if (d >= 1)
            return formatValue(d);
        const sig = d.toPrecision(2);
        return parseFloat(sig).toString();
    }));
    styleAxis(yAxis);
    const colorScale = categoryField
        ? buildColorScale(encoding.color, data)
        : () => categorical[0];
    const area = d3
        .area()
        .x((d) => xScale(d[0]))
        .y0(dims.innerHeight)
        .y1((d) => yScale(d[1]))
        .curve(d3.curveBasis);
    const line = d3
        .line()
        .x((d) => xScale(d[0]))
        .y((d) => yScale(d[1]))
        .curve(d3.curveBasis);
    const fillOpacity = groups.length > 1 ? 0.3 : 0.4;
    const densityGroup = g.append('g').attr('class', 'density-curves');
    groups.forEach((group, gi) => {
        const density = groupDensities.get(group);
        const color = categoryField ? colorScale(group) : categorical[0];
        if (filled) {
            densityGroup
                .append('path')
                .datum(density)
                .attr('class', `density-area density-area-${gi}`)
                .attr('d', area)
                .attr('fill', color)
                .attr('fill-opacity', fillOpacity)
                .attr('pointer-events', 'none');
        }
        densityGroup
            .append('path')
            .datum(density)
            .attr('class', `density-line density-line-${gi}`)
            .attr('d', line)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.9)
            .attr('pointer-events', 'none');
    });
    if (showRug) {
        const rugHeight = 6;
        const rugY = dims.innerHeight;
        if (categoryField) {
            groups.forEach((group) => {
                const vals = groupDataMap.get(group);
                const color = colorScale(group);
                g.selectAll(`.rug-tick-${group.replace(/\s+/g, '-')}`)
                    .data(vals)
                    .join('line')
                    .attr('class', `rug-tick`)
                    .attr('x1', (d) => xScale(d))
                    .attr('x2', (d) => xScale(d))
                    .attr('y1', rugY + 2)
                    .attr('y2', rugY + 2 + rugHeight)
                    .attr('stroke', color)
                    .attr('stroke-width', 1)
                    .attr('stroke-opacity', 0.5)
                    .attr('pointer-events', 'none');
            });
        }
        else {
            g.selectAll('.rug-tick')
                .data(allValues)
                .join('line')
                .attr('class', 'rug-tick')
                .attr('x1', (d) => xScale(d))
                .attr('x2', (d) => xScale(d))
                .attr('y1', rugY + 2)
                .attr('y2', rugY + 2 + rugHeight)
                .attr('stroke', categorical[0])
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 0.4)
                .attr('pointer-events', 'none');
        }
    }
    const crosshair = g
        .append('line')
        .attr('class', 'crosshair')
        .attr('y1', 0)
        .attr('y2', dims.innerHeight)
        .attr('stroke', TEXT_MUTED)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0)
        .attr('pointer-events', 'none');
    const hoverDots = g.append('g').attr('class', 'hover-dots');
    g.append('rect')
        .attr('class', 'overlay')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, g.node());
        const xVal = xScale.invert(mx);
        crosshair
            .attr('x1', mx)
            .attr('x2', mx)
            .attr('opacity', 0.6);
        hoverDots.selectAll('circle').remove();
        let tooltipHtml = '';
        if (categoryField) {
            tooltipHtml += `<strong>${encoding.x?.title || valueField}:</strong> ${formatValue(xVal)}`;
            groups.forEach((group) => {
                const density = groupDensities.get(group);
                const closest = density.reduce((best, pt) => Math.abs(pt[0] - xVal) < Math.abs(best[0] - xVal) ? pt : best);
                const color = colorScale(group);
                const yPos = yScale(closest[1]);
                hoverDots
                    .append('circle')
                    .attr('cx', mx)
                    .attr('cy', yPos)
                    .attr('r', 4)
                    .attr('fill', color)
                    .attr('stroke', '#0f1117')
                    .attr('stroke-width', 1.5)
                    .attr('pointer-events', 'none');
                tooltipHtml += `<br/><span style="color:${color}">\u25CF</span> ${group}: ${closest[1].toFixed(4)}`;
            });
        }
        else {
            const density = groupDensities.get('_all');
            const closest = density.reduce((best, pt) => Math.abs(pt[0] - xVal) < Math.abs(best[0] - xVal) ? pt : best);
            const yPos = yScale(closest[1]);
            hoverDots
                .append('circle')
                .attr('cx', mx)
                .attr('cy', yPos)
                .attr('r', 4)
                .attr('fill', categorical[0])
                .attr('stroke', '#0f1117')
                .attr('stroke-width', 1.5)
                .attr('pointer-events', 'none');
            tooltipHtml = `<strong>${encoding.x?.title || valueField}:</strong> ${formatValue(xVal)}`;
            tooltipHtml += `<br/>Density: ${closest[1].toFixed(4)}`;
        }
        showTooltip(tooltip, tooltipHtml, event);
    })
        .on('mouseleave', function () {
        crosshair.attr('opacity', 0);
        hoverDots.selectAll('circle').remove();
        hideTooltip(tooltip);
    });
    if (categoryField && groups.length > 1) {
        const legendDiv = createLegend(colorScale, {
            shape: 'circle',
            callbacks: {
                onHover: (group) => {
                    const gi = groups.indexOf(group);
                    groups.forEach((_, i) => {
                        const areaOpacity = i === gi ? Math.min(fillOpacity + 0.2, 0.7) : 0.08;
                        const lineOpacity = i === gi ? 1 : 0.15;
                        const lineWidth = i === gi ? 3 : 1.5;
                        densityGroup.selectAll(`.density-area-${i}`).attr('fill-opacity', areaOpacity);
                        densityGroup.selectAll(`.density-line-${i}`)
                            .attr('stroke-opacity', lineOpacity)
                            .attr('stroke-width', lineWidth);
                    });
                },
                onLeave: () => {
                    groups.forEach((_, i) => {
                        densityGroup.selectAll(`.density-area-${i}`).attr('fill-opacity', fillOpacity);
                        densityGroup.selectAll(`.density-line-${i}`)
                            .attr('stroke-opacity', 0.9)
                            .attr('stroke-width', 2);
                    });
                },
            },
        });
        container.appendChild(legendDiv);
    }
}
//# sourceMappingURL=density-plot.js.map