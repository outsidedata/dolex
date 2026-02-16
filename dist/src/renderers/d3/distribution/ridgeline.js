/**
 * Ridgeline plot D3 renderer (Joy Division style).
 *
 * Stacked density curves — each group is a row with an overlapping
 * filled area chart. Groups listed vertically, value axis horizontal.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, createLegend, formatValue, styleAxis, getAdaptiveTickCount, calculateLeftMargin, truncateLabel, TEXT_MUTED, DARK_BG, } from '../shared.js';
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
/** Compute KDE for a set of values at the given sample points. */
function kde(values, samplePoints, bandwidth) {
    const n = values.length;
    return samplePoints.map((x) => {
        const density = values.reduce((sum, xi) => sum + gaussianKernel((x - xi) / bandwidth), 0) /
            (n * bandwidth);
        return { value: x, density };
    });
}
/** Silverman's rule of thumb for bandwidth selection. */
function silvermanBandwidth(values) {
    const sd = stdDev(values);
    const n = values.length;
    const bw = 1.06 * sd * Math.pow(n, -0.2);
    if (bw > 0)
        return bw;
    const range = (Math.max(...values) - Math.min(...values));
    return range > 0 ? range * 0.1 : 1;
}
/** Compute median from sorted values. */
function median(sorted) {
    const n = sorted.length;
    if (n === 0)
        return 0;
    return n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
// ─── RENDERER ─────────────────────────────────────────────────────────────────
export function renderRidgeline(container, spec) {
    const { config, encoding, data } = spec;
    const valueField = config.valueField || encoding.x?.field || Object.keys(data[0]).find((k) => typeof data[0][k] === 'number') || Object.keys(data[0])[1];
    const categoryField = config.categoryField || encoding.y?.field || Object.keys(data[0])[0];
    const overlap = config.overlap ?? 0.5;
    const fillOpacity = config.fillOpacity ?? 0.7;
    const strokeWidth = config.strokeWidth ?? 1.5;
    const userBandwidth = typeof config.bandwidth === 'number' ? config.bandwidth : undefined;
    // Group data
    const groups = [...new Set(data.map((d) => d[categoryField]))];
    const allValues = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
    const colorScale = buildColorScale(encoding.color, data);
    // ── Container layout: flex column with chartWrapper + legend ──
    const containerWidth = container.clientWidth || 800;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    // Legend below chart — only for small containers where left-side labels
    // get truncated or cramped. For larger sizes the group labels at each
    // baseline serve as the legend.
    const showBottomLegend = groups.length > 1 && containerWidth < 600;
    if (showBottomLegend) {
        const legendDiv = createLegend(colorScale);
        container.appendChild(legendDiv);
    }
    // ── Adaptive margins ──
    // When bottom legend is active, skip left-side labels → slim left margin
    const groupLabels = groups.map(String);
    const leftMargin = showBottomLegend ? 20 : calculateLeftMargin(groupLabels);
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        left: leftMargin,
        bottom: 50,
        right: 30,
        top: 40,
    });
    const tooltip = createTooltip(container);
    // ── X scale: value axis (horizontal) ──
    const valuePadding = (d3.max(allValues) - d3.min(allValues)) * 0.05 || 1;
    const xScale = d3
        .scaleLinear()
        .domain([d3.min(allValues) - valuePadding, d3.max(allValues) + valuePadding])
        .range([0, dims.innerWidth])
        .nice();
    // ── X-axis: direct creation + styleAxis ──
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
    // ── Compute row geometry ──
    const effectiveRows = groups.length * (1 - overlap) + overlap;
    const rawRowHeight = dims.innerHeight / effectiveRows;
    const rowHeight = groups.length === 1
        ? Math.min(rawRowHeight, dims.innerHeight * 0.4)
        : rawRowHeight;
    // ── KDE sample points ──
    const xDomain = xScale.domain();
    const sampleCount = 80;
    const step = (xDomain[1] - xDomain[0]) / (sampleCount - 1);
    const samplePoints = Array.from({ length: sampleCount }, (_, i) => xDomain[0] + i * step);
    // ── Compute all KDEs for normalization ──
    const groupKDEs = [];
    let globalMaxDensity = 0;
    groups.forEach((group) => {
        const groupValues = data
            .filter((d) => d[categoryField] === group)
            .map((d) => Number(d[valueField]))
            .filter((v) => !isNaN(v))
            .sort((a, b) => a - b);
        if (groupValues.length === 0) {
            groupKDEs.push({ group, density: samplePoints.map((v) => ({ value: v, density: 0 })), values: groupValues });
            return;
        }
        const bandwidth = userBandwidth || silvermanBandwidth(groupValues);
        const densityPoints = kde(groupValues, samplePoints, bandwidth);
        const maxDensity = d3.max(densityPoints, (d) => d.density) || 0;
        if (maxDensity > globalMaxDensity)
            globalMaxDensity = maxDensity;
        groupKDEs.push({ group, density: densityPoints, values: groupValues });
    });
    if (globalMaxDensity === 0)
        globalMaxDensity = 1;
    // ── Full-row hover targets (drawn first, behind everything) ──
    for (let i = 0; i < groups.length; i++) {
        const { group, values: groupValues } = groupKDEs[i];
        const yBaseline = dims.innerHeight - i * rowHeight * (1 - overlap);
        const yTop = yBaseline - rowHeight;
        g.append('rect')
            .attr('class', 'ridge-hover-target')
            .attr('x', 0)
            .attr('y', yTop)
            .attr('width', dims.innerWidth)
            .attr('height', rowHeight)
            .attr('fill', 'transparent')
            .attr('cursor', 'pointer')
            .on('mouseover', function (event) {
            // Highlight this group's ridge
            g.selectAll(`.ridge-${i}`)
                .attr('fill-opacity', Math.min(fillOpacity + 0.2, 1))
                .attr('stroke-width', strokeWidth + 1);
            const med = groupValues.length > 0 ? median(groupValues) : 0;
            const min = groupValues.length > 0 ? groupValues[0] : 0;
            const max = groupValues.length > 0 ? groupValues[groupValues.length - 1] : 0;
            showTooltip(tooltip, `<strong>${group}</strong><br/>` +
                `Count: ${groupValues.length}<br/>` +
                `Median: ${formatValue(med)}<br/>` +
                `Min: ${formatValue(min)}<br/>` +
                `Max: ${formatValue(max)}`, event);
        })
            .on('mousemove', (event) => {
            positionTooltip(tooltip, event);
        })
            .on('mouseout', function () {
            g.selectAll(`.ridge-${i}`)
                .attr('fill-opacity', fillOpacity)
                .attr('stroke-width', strokeWidth);
            hideTooltip(tooltip);
        });
    }
    // ── Draw ridges from bottom to top (Joy Division front-to-back) ──
    const singleGroupOffset = groups.length === 1
        ? (dims.innerHeight - rowHeight) / 2
        : 0;
    for (let i = groups.length - 1; i >= 0; i--) {
        const { group, density } = groupKDEs[i];
        const yBaseline = dims.innerHeight - i * rowHeight * (1 - overlap) - singleGroupOffset;
        const heightScale = (d) => (d / globalMaxDensity) * rowHeight;
        const colorValue = encoding.color?.field ? data.find((d) => d[categoryField] === group)?.[encoding.color.field] : group;
        const fillColor = colorScale(colorValue);
        // Area generator
        const areaGen = d3
            .area()
            .x((d) => xScale(d.value))
            .y0(yBaseline)
            .y1((d) => yBaseline - heightScale(d.density))
            .curve(d3.curveBasis);
        // Background fill to occlude ridges behind
        g.append('path')
            .datum(density)
            .attr('d', areaGen)
            .attr('fill', DARK_BG)
            .attr('stroke', 'none')
            .attr('pointer-events', 'none');
        // Colored fill
        g.append('path')
            .datum(density)
            .attr('class', `ridge ridge-${i}`)
            .attr('d', areaGen)
            .attr('fill', fillColor)
            .attr('fill-opacity', fillOpacity)
            .attr('stroke', fillColor)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-opacity', 0.9)
            .attr('pointer-events', 'none');
        // Group label on the left at baseline — only when no bottom legend
        if (!showBottomLegend) {
            g.append('text')
                .attr('x', -10)
                .attr('y', yBaseline)
                .attr('text-anchor', 'end')
                .attr('dominant-baseline', 'middle')
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .attr('pointer-events', 'none')
                .text(truncateLabel(String(group), 18));
        }
    }
}
//# sourceMappingURL=ridgeline.js.map