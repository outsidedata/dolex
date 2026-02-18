/**
 * Relationship renderers — scatter.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, styleAxis, getAdaptiveTickCount, createLegend, DARK_BG, TEXT_MUTED, } from './shared.js';
import { categorical } from '../../theme/colors.js';
// ─── SCATTER PLOT ────────────────────────────────────────────────────────────
export function renderScatter(container, spec) {
    const { config, encoding, data } = spec;
    const xField = config.xField || encoding.x?.field;
    const yField = config.yField || encoding.y?.field;
    const colorField = config.colorField || encoding.color?.field || null;
    const sizeField = config.sizeField || encoding.size?.field || null;
    const baseRadius = config.dotRadius ?? 5;
    const opacity = config.opacity ?? 0.7;
    const hasLegend = colorField !== null;
    // ── Container layout: flex column with chartWrapper + legend ──
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'flex: 1; min-height: 0;';
    container.appendChild(chartWrapper);
    const { svg, g, dims } = createSvg(chartWrapper, spec, { right: 30 });
    const tooltip = createTooltip(container);
    // ── Filter out NaN/Infinity values ──
    const validData = data.filter((d) => {
        const xVal = Number(d[xField]);
        const yVal = Number(d[yField]);
        return isFinite(xVal) && isFinite(yVal);
    });
    if (validData.length === 0) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:14px;font-family:Inter,system-ui,sans-serif;background:#0f1117;border-radius:8px;">No valid numeric data for scatter plot</div>`;
        return;
    }
    // ── Scales ──
    const xValues = validData.map((d) => Number(d[xField]));
    const yValues = validData.map((d) => Number(d[yField]));
    const xExtent = d3.extent(xValues);
    const yExtent = d3.extent(yValues);
    const xPad = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const yPad = (yExtent[1] - yExtent[0]) * 0.05 || 1;
    const xScale = d3
        .scaleLinear()
        .domain([xExtent[0] - xPad, xExtent[1] + xPad])
        .range([0, dims.innerWidth])
        .nice();
    const yScale = d3
        .scaleLinear()
        .domain([yExtent[0] - yPad, yExtent[1] + yPad])
        .range([dims.innerHeight, 0])
        .nice();
    // ── Axes: direct creation + styleAxis ──
    const xTickCount = getAdaptiveTickCount(dims.innerWidth);
    const yTickCount = getAdaptiveTickCount(dims.innerHeight, 40);
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
    // ── Color scale ──
    const colorScale = buildColorScale(encoding.color, validData);
    // ── Size scale ──
    let sizeScale = () => baseRadius;
    if (sizeField) {
        const sizeExtent = d3.extent(validData, (d) => Number(d[sizeField]));
        const maxBubbleRadius = Math.min(dims.innerWidth, dims.innerHeight) * 0.06;
        const sizeRange = encoding.size?.range || [3, 20];
        const clampedRange = [
            Math.min(sizeRange[0], maxBubbleRadius),
            Math.min(sizeRange[1], maxBubbleRadius),
        ];
        sizeScale = d3.scaleSqrt().domain(sizeExtent).range(clampedRange);
    }
    // ── Adaptive dot radius ──
    // Scale down when many points in a small area
    const pointDensity = validData.length / ((dims.innerWidth * dims.innerHeight) / 10000);
    let dotRadius = baseRadius;
    if (!sizeField) {
        if (pointDensity > 5)
            dotRadius = Math.max(2, baseRadius - 2);
        else if (pointDensity > 2)
            dotRadius = Math.max(3, baseRadius - 1);
    }
    // ── Jitter ──
    const jitter = config.jitter ?? 0;
    // Pre-compute positions for hover targets and dots
    const pointPositions = validData.map((d, i) => {
        const xBase = xScale(Number(d[xField]));
        const yBase = yScale(Number(d[yField]));
        return {
            d,
            i,
            cx: jitter ? xBase + (seededJitter(i, 0) - 0.5) * jitter : xBase,
            cy: jitter ? yBase + (seededJitter(i, 1) - 0.5) * jitter : yBase,
            r: sizeField ? sizeScale(Number(d[sizeField])) : dotRadius,
        };
    });
    // ── Voronoi hover layer ──
    // d3.Delaunay gives each point a region — nearest point always wins, no dead zones
    const delaunay = d3.Delaunay.from(pointPositions, (p) => p.cx, (p) => p.cy);
    let activeIdx = -1;
    // Invisible rect covering the plot area to capture all mouse events
    g.append('rect')
        .attr('class', 'voronoi-overlay')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair')
        .on('mousemove', function (event) {
        const [mx, my] = d3.pointer(event, g.node());
        const idx = delaunay.find(mx, my);
        if (idx === activeIdx) {
            // Just update tooltip position
            positionTooltip(tooltip, event);
            return;
        }
        // Reset previous
        if (activeIdx >= 0) {
            const prev = pointPositions[activeIdx];
            g.selectAll('.dot')
                .filter((_, j) => j === prev.i)
                .attr('r', prev.r)
                .attr('opacity', opacity);
        }
        activeIdx = idx;
        const p = pointPositions[idx];
        // Highlight new dot
        g.selectAll('.dot')
            .filter((_, j) => j === p.i)
            .attr('r', p.r * 1.5)
            .attr('opacity', 1);
        let html = `<strong>${encoding.x?.title || xField}</strong>: ${formatValue(Number(p.d[xField]))}<br/><strong>${encoding.y?.title || yField}</strong>: ${formatValue(Number(p.d[yField]))}`;
        if (colorField)
            html += `<br/>${colorField}: ${p.d[colorField]}`;
        if (sizeField)
            html += `<br/>${sizeField}: ${formatValue(Number(p.d[sizeField]))}`;
        showTooltip(tooltip, html, event);
    })
        .on('mouseleave', function () {
        if (activeIdx >= 0) {
            const prev = pointPositions[activeIdx];
            g.selectAll('.dot')
                .filter((_, j) => j === prev.i)
                .attr('r', prev.r)
                .attr('opacity', opacity);
            activeIdx = -1;
        }
        hideTooltip(tooltip);
    });
    // ── Visible dots (pointer-events: none, instant) ──
    g.selectAll('.dot')
        .data(pointPositions)
        .join('circle')
        .attr('class', 'dot')
        .attr('cx', (p) => p.cx)
        .attr('cy', (p) => p.cy)
        .attr('r', (p) => p.r)
        .attr('fill', (p) => (colorField ? colorScale(p.d[colorField]) : categorical[0]))
        .attr('opacity', opacity)
        .attr('stroke', DARK_BG)
        .attr('stroke-width', 1)
        .attr('pointer-events', 'none');
    // ── All-same-point annotation ──
    if (xExtent[0] === xExtent[1] && yExtent[0] === yExtent[1] && validData.length > 1) {
        g.append('text')
            .attr('x', xScale(xExtent[0]))
            .attr('y', yScale(yExtent[0]) - 20)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '11px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text(`${validData.length} points at (${formatValue(xExtent[0])}, ${formatValue(yExtent[0])})`);
    }
    // ── Trend line ──
    if (config.showTrendLine || config.showRegressionLine) {
        const validData = data
            .map((d) => ({ x: Number(d[xField]), y: Number(d[yField]) }))
            .filter((d) => !isNaN(d.x) && !isNaN(d.y));
        if (validData.length >= 2) {
            const n = validData.length;
            const sumX = validData.reduce((s, d) => s + d.x, 0);
            const sumY = validData.reduce((s, d) => s + d.y, 0);
            const sumXY = validData.reduce((s, d) => s + d.x * d.y, 0);
            const sumX2 = validData.reduce((s, d) => s + d.x * d.x, 0);
            const denom = n * sumX2 - sumX * sumX;
            if (Math.abs(denom) > 1e-10) {
                const slope = (n * sumXY - sumX * sumY) / denom;
                const intercept = (sumY - slope * sumX) / n;
                const x1 = xExtent[0];
                const x2 = xExtent[1];
                g.append('line')
                    .attr('x1', xScale(x1))
                    .attr('y1', yScale(slope * x1 + intercept))
                    .attr('x2', xScale(x2))
                    .attr('y2', yScale(slope * x2 + intercept))
                    .attr('stroke', '#f59e0b')
                    .attr('stroke-width', 1.5)
                    .attr('stroke-dasharray', '6,4')
                    .attr('opacity', 0.7)
                    .attr('pointer-events', 'none');
            }
        }
    }
    // ── HTML legend (below chart) with hover highlighting ──
    if (hasLegend) {
        const legendDiv = createLegend(colorScale, { shape: 'circle', callbacks: {
                onHover: (category) => {
                    // Highlight matching dots, fade the rest
                    g.selectAll('.dot').each(function (_, j) {
                        const p = pointPositions[j];
                        const isMatch = p.d[colorField] === category;
                        d3.select(this)
                            .attr('opacity', isMatch ? 1 : 0.08)
                            .attr('r', isMatch ? p.r * 1.3 : p.r);
                    });
                },
                onLeave: () => {
                    // Reset all dots
                    g.selectAll('.dot').each(function (_, j) {
                        const p = pointPositions[j];
                        d3.select(this)
                            .attr('opacity', opacity)
                            .attr('r', p.r);
                    });
                },
            } });
        container.appendChild(legendDiv);
    }
}
// ── Deterministic jitter (no Math.random) ──
function seededJitter(index, axis) {
    let s = (index + 1) * 16807 + axis * 12345;
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
}
//# sourceMappingURL=relationship.js.map