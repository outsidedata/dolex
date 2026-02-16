/**
 * Connected Scatter Plot D3 renderer.
 *
 * Scatter plot where points are connected by lines in sequence
 * (temporal/ordinal order). Shows trajectory of x,y values over time.
 * Best for showing how two variables co-evolve across an ordered dimension.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, styleAxis, getAdaptiveTickCount, createLegend, DARK_BG, TEXT_MUTED, } from './shared.js';
import { categorical } from '../../theme/colors.js';
// ─── CONNECTED SCATTER PLOT ─────────────────────────────────────────────────
export function renderConnectedScatter(container, spec) {
    const { config, encoding, data } = spec;
    const xField = config.xField || encoding.x?.field;
    const yField = config.yField || encoding.y?.field;
    const orderField = config.orderField;
    const colorField = config.colorField || encoding.color?.field || null;
    const showArrows = config.showArrows ?? false;
    const strokeWidth = config.strokeWidth ?? 1.5;
    const baseDotRadius = config.dotRadius ?? 4;
    const showLabels = config.showLabels ?? false;
    if (!xField || !yField)
        return;
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
    // ── Parse and sort data by order field ──
    const parsed = data.map((d, i) => ({
        ...d,
        _x: Number(d[xField]),
        _y: Number(d[yField]),
        _order: orderField ? d[orderField] : i,
        _idx: i,
    })).filter(d => !isNaN(d._x) && !isNaN(d._y));
    const sortByOrder = (a, b) => {
        const aVal = a._order;
        const bVal = b._order;
        if (typeof aVal === 'number' && typeof bVal === 'number')
            return aVal - bVal;
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum))
            return aNum - bNum;
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        if (!isNaN(aDate) && !isNaN(bDate))
            return aDate - bDate;
        return String(aVal).localeCompare(String(bVal));
    };
    // ── Scales ──
    const xExtent = d3.extent(parsed, (d) => d._x);
    const yExtent = d3.extent(parsed, (d) => d._y);
    const xPad = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const yPad = (yExtent[1] - yExtent[0]) * 0.05 || 1;
    const xScale = d3.scaleLinear()
        .domain([xExtent[0] - xPad, xExtent[1] + xPad])
        .range([0, dims.innerWidth])
        .nice();
    const yScale = d3.scaleLinear()
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
        .call(d3.axisBottom(xScale)
        .ticks(xTickCount)
        .tickSize(-dims.innerHeight)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(xAxis);
    const yAxis = g
        .append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale)
        .ticks(yTickCount)
        .tickSize(-dims.innerWidth)
        .tickPadding(8)
        .tickFormat((d) => formatValue(d)));
    styleAxis(yAxis);
    // ── Color scale ──
    const colorScale = buildColorScale(encoding.color, data);
    // ── Adaptive dot radius ──
    const pointDensity = parsed.length / ((dims.innerWidth * dims.innerHeight) / 10000);
    let dotRadius = baseDotRadius;
    if (pointDensity > 5)
        dotRadius = Math.max(2, baseDotRadius - 2);
    else if (pointDensity > 2)
        dotRadius = Math.max(3, baseDotRadius - 1);
    // ── Arrow marker definitions ──
    if (showArrows) {
        const defs = svg.append('defs');
        if (hasLegend) {
            const entities = [...new Set(parsed.map((d) => d[colorField]))];
            entities.forEach((entity, i) => {
                defs.append('marker')
                    .attr('id', `arrow-${i}`)
                    .attr('viewBox', '0 0 10 10')
                    .attr('refX', 8)
                    .attr('refY', 5)
                    .attr('markerWidth', 6)
                    .attr('markerHeight', 6)
                    .attr('orient', 'auto-start-reverse')
                    .append('path')
                    .attr('d', 'M 0 0 L 10 5 L 0 10 z')
                    .attr('fill', colorScale(entity));
            });
        }
        else {
            defs.append('marker')
                .attr('id', 'arrow-0')
                .attr('viewBox', '0 0 10 10')
                .attr('refX', 8)
                .attr('refY', 5)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto-start-reverse')
                .append('path')
                .attr('d', 'M 0 0 L 10 5 L 0 10 z')
                .attr('fill', categorical[0]);
        }
    }
    // ── Line generator ──
    const line = d3.line()
        .x((d) => xScale(d._x))
        .y((d) => yScale(d._y))
        .curve(d3.curveMonotoneX);
    const pointPositions = [];
    // ── Build entity groups and render paths + dots ──
    if (hasLegend) {
        const entities = [...new Set(parsed.map((d) => d[colorField]))];
        entities.forEach((entity, entityIdx) => {
            const entityData = parsed.filter((d) => d[colorField] === entity);
            entityData.sort(sortByOrder);
            const color = colorScale(entity);
            // Draw connected path
            const path = g.append('path')
                .datum(entityData)
                .attr('class', 'trajectory-path')
                .attr('data-entity', entity)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', strokeWidth)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round')
                .attr('pointer-events', 'none')
                .attr('d', line);
            if (showArrows) {
                path.attr('marker-end', `url(#arrow-${entityIdx})`);
            }
            // Draw dots
            g.selectAll(`.dot-${entityIdx}`)
                .data(entityData)
                .join('circle')
                .attr('class', `dot dot-entity-${entityIdx}`)
                .attr('data-entity', entity)
                .attr('cx', (d) => xScale(d._x))
                .attr('cy', (d) => yScale(d._y))
                .attr('r', dotRadius)
                .attr('fill', color)
                .attr('stroke', DARK_BG)
                .attr('stroke-width', 1.5)
                .attr('pointer-events', 'none');
            // Collect positions for Voronoi
            entityData.forEach((d, i) => {
                pointPositions.push({
                    d,
                    cx: xScale(d._x),
                    cy: yScale(d._y),
                    entity: entity,
                    orderLabel: orderField ? `${orderField}: ${d._order}` : `Step ${i + 1}`,
                    globalIdx: pointPositions.length,
                });
            });
            // Labels (sequence numbers) — skip labels at overlapping positions
            if (showLabels) {
                const usedPositions = [];
                const minDist = dotRadius * 3;
                g.selectAll(`.label-${entityIdx}`)
                    .data(entityData)
                    .join('text')
                    .attr('class', `seq-label label-${entityIdx}`)
                    .attr('x', (d) => xScale(d._x) + dotRadius + 3)
                    .attr('y', (d) => yScale(d._y) - dotRadius - 2)
                    .attr('fill', TEXT_MUTED)
                    .attr('font-size', '9px')
                    .attr('font-family', 'Inter, system-ui, sans-serif')
                    .attr('pointer-events', 'none')
                    .text((d, i) => {
                    const px = xScale(d._x);
                    const py = yScale(d._y);
                    const tooClose = usedPositions.some(p => Math.abs(p.x - px) < minDist && Math.abs(p.y - py) < minDist);
                    if (tooClose)
                        return '';
                    usedPositions.push({ x: px, y: py });
                    return i + 1;
                });
            }
        });
    }
    else {
        // Single entity
        parsed.sort(sortByOrder);
        const color = categorical[0];
        // Draw connected path
        const path = g.append('path')
            .datum(parsed)
            .attr('class', 'trajectory-path')
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('pointer-events', 'none')
            .attr('d', line);
        if (showArrows) {
            path.attr('marker-end', 'url(#arrow-0)');
        }
        // Draw dots
        g.selectAll('.dot')
            .data(parsed)
            .join('circle')
            .attr('class', 'dot')
            .attr('cx', (d) => xScale(d._x))
            .attr('cy', (d) => yScale(d._y))
            .attr('r', dotRadius)
            .attr('fill', color)
            .attr('stroke', DARK_BG)
            .attr('stroke-width', 1.5)
            .attr('pointer-events', 'none');
        // Collect positions for Voronoi
        parsed.forEach((d, i) => {
            pointPositions.push({
                d,
                cx: xScale(d._x),
                cy: yScale(d._y),
                entity: null,
                orderLabel: orderField ? `${orderField}: ${d._order}` : `Step ${i + 1}`,
                globalIdx: i,
            });
        });
        // Labels (sequence numbers) — skip labels at overlapping positions
        if (showLabels) {
            const usedPositions = [];
            const minDist = dotRadius * 3;
            g.selectAll('.seq-label')
                .data(parsed)
                .join('text')
                .attr('class', 'seq-label')
                .attr('x', (d) => xScale(d._x) + dotRadius + 3)
                .attr('y', (d) => yScale(d._y) - dotRadius - 2)
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '9px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .attr('pointer-events', 'none')
                .text((d, i) => {
                const px = xScale(d._x);
                const py = yScale(d._y);
                const tooClose = usedPositions.some(p => Math.abs(p.x - px) < minDist && Math.abs(p.y - py) < minDist);
                if (tooClose)
                    return '';
                usedPositions.push({ x: px, y: py });
                return i + 1;
            });
        }
    }
    // ── Voronoi hover layer ──
    const delaunay = d3.Delaunay.from(pointPositions, (p) => p.cx, (p) => p.cy);
    let activeIdx = -1;
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
            positionTooltip(tooltip, event);
            return;
        }
        // Reset previous
        if (activeIdx >= 0) {
            g.selectAll('.dot')
                .filter(function () { return d3.select(this).attr('data-active') === 'true'; })
                .attr('r', dotRadius)
                .attr('data-active', null);
        }
        activeIdx = idx;
        const p = pointPositions[idx];
        // Highlight the nearest dot
        // Find by matching cx/cy coordinates
        g.selectAll('.dot')
            .each(function () {
            const el = d3.select(this);
            const cx = parseFloat(el.attr('cx'));
            const cy = parseFloat(el.attr('cy'));
            if (Math.abs(cx - p.cx) < 0.5 && Math.abs(cy - p.cy) < 0.5) {
                el.attr('r', dotRadius * 1.5).attr('data-active', 'true');
            }
        });
        // Tooltip
        let html = '';
        if (p.entity)
            html += `<strong>${p.entity}</strong><br/>`;
        html += `${p.orderLabel}<br/>`;
        html += `<strong>${encoding.x?.title || xField}:</strong> ${formatValue(p.d._x)}<br/>`;
        html += `<strong>${encoding.y?.title || yField}:</strong> ${formatValue(p.d._y)}`;
        showTooltip(tooltip, html, event);
    })
        .on('mouseleave', function () {
        if (activeIdx >= 0) {
            g.selectAll('.dot')
                .filter(function () { return d3.select(this).attr('data-active') === 'true'; })
                .attr('r', dotRadius)
                .attr('data-active', null);
            activeIdx = -1;
        }
        hideTooltip(tooltip);
    });
    // ── HTML legend (below chart) with hover highlighting ──
    if (hasLegend) {
        const legendDiv = createLegend(colorScale, { shape: 'line-dot', callbacks: {
                onHover: (category) => {
                    // Highlight matching entity, fade others
                    g.selectAll('.trajectory-path').each(function () {
                        const el = d3.select(this);
                        el.attr('opacity', el.attr('data-entity') === category ? 1 : 0.12);
                    });
                    g.selectAll('.dot').each(function () {
                        const el = d3.select(this);
                        el.attr('opacity', el.attr('data-entity') === category ? 1 : 0.12);
                    });
                    g.selectAll('.seq-label')
                        .attr('opacity', 0.15);
                },
                onLeave: () => {
                    g.selectAll('.trajectory-path').attr('opacity', 1);
                    g.selectAll('.dot').attr('opacity', 1);
                    g.selectAll('.seq-label').attr('opacity', 1);
                },
            } });
        container.appendChild(legendDiv);
    }
}
//# sourceMappingURL=connected-scatter.js.map