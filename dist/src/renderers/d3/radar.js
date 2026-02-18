/**
 * Radar Chart (Spider Chart) D3 renderer.
 *
 * Renders overlaid polygons on radial axes, one axis per dimension,
 * one polygon per entity. Best for 1-4 entities across 3-10 dimensions.
 *
 * Standards: HTML legend below SVG, polygon-level hover, adaptive sizing.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, truncateLabel, createLegend, DARK_BG, TEXT_MUTED, GRID_COLOR, AXIS_COLOR, } from './shared.js';
// ─── RADAR RENDERER ──────────────────────────────────────────────────────────
export function renderRadar(container, spec) {
    const { config, data } = spec;
    const categoryField = config.categoryField || 'entity';
    const dimensions = config.dimensions || [];
    const showLabels = config.showLabels !== false;
    const showGrid = config.showGrid !== false;
    const gridLevels = config.gridLevels || 5;
    const fillOpacity = config.fillOpacity ?? 0.2;
    const strokeWidth = config.strokeWidth ?? 2;
    const dotRadius = config.dotRadius ?? 4;
    if (dimensions.length < 3) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:14px;font-family:Inter,system-ui,sans-serif;background:#0f1117;border-radius:8px;">Radar chart requires 3+ dimensions (got ${dimensions.length})</div>`;
        return;
    }
    const hasLegend = data.length > 1;
    // ── Container layout: flex column with chartWrapper + legend ──
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.cssText = 'flex: 1; min-height: 0;';
    container.appendChild(chartWrapper);
    // Use createSvg for consistent SVG + title + background
    // Radar needs equal margins all around for the circular layout
    const containerWidth = container.clientWidth || 500;
    const containerHeight = container.clientHeight || 500;
    const isSmall = Math.min(containerWidth, containerHeight) < 320;
    // Adaptive margins: radar labels sit outside the circle, need room
    const labelMargin = isSmall ? 40 : 55;
    const { svg, g, dims } = createSvg(chartWrapper, spec, {
        top: spec.title ? 55 : 40,
        right: labelMargin,
        bottom: 40,
        left: labelMargin,
    });
    const tooltip = createTooltip(container);
    // ── Compute radar geometry centered in the inner area ──
    const radius = Math.min(dims.innerWidth, dims.innerHeight) / 2;
    const cx = dims.innerWidth / 2;
    const cy = dims.innerHeight / 2;
    const center = g.append('g')
        .attr('transform', `translate(${cx}, ${cy})`);
    const angleSlice = (Math.PI * 2) / dimensions.length;
    // ── Scale: find min/max across all entities and dimensions ──
    let minVal = 0;
    let maxVal = 0;
    for (const row of data) {
        for (const dim of dimensions) {
            const v = Number(row[dim]) || 0;
            if (v < minVal)
                minVal = v;
            if (v > maxVal)
                maxVal = v;
        }
    }
    if (maxVal === 0 && minVal === 0)
        maxVal = 1;
    const rScale = d3.scaleLinear()
        .domain([minVal, maxVal])
        .range([0, radius]);
    // ── Grid rings ──
    if (showGrid) {
        for (let level = 1; level <= gridLevels; level++) {
            const r = (radius / gridLevels) * level;
            const points = dimensions.map((_, i) => {
                const angle = angleSlice * i - Math.PI / 2;
                return [r * Math.cos(angle), r * Math.sin(angle)];
            });
            center.append('polygon')
                .attr('points', points.map((p) => p.join(',')).join(' '))
                .attr('fill', 'none')
                .attr('stroke', GRID_COLOR)
                .attr('stroke-width', 0.5);
            // Grid level value labels (along 12 o'clock axis)
            const labelVal = minVal + ((maxVal - minVal) / gridLevels) * level;
            center.append('text')
                .attr('x', 4)
                .attr('y', -r)
                .attr('fill', TEXT_MUTED)
                .attr('font-size', isSmall ? '8px' : '9px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .attr('opacity', 0.6)
                .text(formatValue(Math.round(labelVal * 100) / 100));
        }
    }
    // ── Zero ring (when data includes negatives) ──
    if (minVal < 0) {
        const zeroR = rScale(0);
        const zeroPoints = dimensions.map((_, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            return [zeroR * Math.cos(angle), zeroR * Math.sin(angle)];
        });
        center.append('polygon')
            .attr('points', zeroPoints.map((p) => p.join(',')).join(' '))
            .attr('fill', 'none')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,3')
            .attr('opacity', 0.5);
    }
    // ── Axis lines + dimension labels ──
    const maxLabelLen = isSmall ? 10 : 16;
    dimensions.forEach((dim, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const lineX = radius * Math.cos(angle);
        const lineY = radius * Math.sin(angle);
        center.append('line')
            .attr('x1', 0).attr('y1', 0)
            .attr('x2', lineX).attr('y2', lineY)
            .attr('stroke', AXIS_COLOR)
            .attr('stroke-width', 0.5);
        if (showLabels) {
            const labelR = radius + (isSmall ? 10 : 14);
            const lx = labelR * Math.cos(angle);
            const ly = labelR * Math.sin(angle);
            const anchor = Math.abs(lx) < 1 ? 'middle' : lx > 0 ? 'start' : 'end';
            center.append('text')
                .attr('x', lx)
                .attr('y', ly)
                .attr('text-anchor', anchor)
                .attr('dominant-baseline', 'central')
                .attr('fill', TEXT_MUTED)
                .attr('font-size', isSmall ? '9px' : '11px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(truncateLabel(dim, maxLabelLen));
        }
    });
    // ── Color scale ──
    // Build a color scale from entities for consistent coloring
    const entityNames = data.map((d) => String(d[categoryField]));
    const colorEncoding = data.length > 1
        ? { field: categoryField, type: 'nominal' }
        : undefined;
    const colorScale = buildColorScale(colorEncoding, data);
    // Helper: compute polygon points for a data row
    function getPolygonPoints(row) {
        return dimensions.map((dim, i) => {
            const val = Number(row[dim]) || 0;
            const angle = angleSlice * i - Math.PI / 2;
            const r = rScale(val);
            return [r * Math.cos(angle), r * Math.sin(angle)];
        });
    }
    // Adaptive dot radius for small containers
    const effectiveDotRadius = isSmall ? Math.min(dotRadius, 3) : dotRadius;
    // ── Draw entity polygons ──
    // For each entity: polygon fill → polygon stroke → dots
    // Polygons are interactive for entity-level hover
    let activeEntity = null;
    function highlightEntity(entity) {
        activeEntity = entity;
        if (entity === null) {
            // Reset all
            center.selectAll('.radar-polygon')
                .attr('fill-opacity', fillOpacity)
                .attr('stroke-width', strokeWidth);
            center.selectAll('.radar-dot')
                .attr('opacity', 1);
        }
        else {
            // Highlight the hovered entity, fade others
            center.selectAll('.radar-polygon').each(function () {
                const el = d3.select(this);
                const isMatch = el.attr('data-entity') === entity;
                el.attr('fill-opacity', isMatch ? Math.min(fillOpacity + 0.15, 0.5) : fillOpacity * 0.3)
                    .attr('stroke-width', isMatch ? strokeWidth + 1 : strokeWidth * 0.5);
            });
            center.selectAll('.radar-dot').each(function () {
                const el = d3.select(this);
                const isMatch = el.attr('data-entity') === entity;
                el.attr('opacity', isMatch ? 1 : 0.15);
            });
        }
    }
    data.forEach((row, entityIdx) => {
        const entity = String(row[categoryField]);
        const color = colorScale(entity);
        const points = getPolygonPoints(row);
        const pointsStr = points.map((p) => p.join(',')).join(' ');
        // Filled polygon (interactive)
        center.append('polygon')
            .attr('class', 'radar-polygon')
            .attr('data-entity', entity)
            .attr('points', pointsStr)
            .attr('fill', color)
            .attr('fill-opacity', fillOpacity)
            .attr('stroke', color)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-linejoin', 'round')
            .style('cursor', 'pointer')
            .on('mouseover', (event) => {
            highlightEntity(entity);
            // Build entity summary tooltip
            const dimValues = dimensions.map((dim) => {
                const val = Number(row[dim]) || 0;
                return `${truncateLabel(dim, 14)}: ${formatValue(val)}`;
            }).join('<br/>');
            showTooltip(tooltip, `<strong>${entity}</strong><br/>${dimValues}`, event);
        })
            .on('mousemove', (event) => {
            positionTooltip(tooltip, event);
        })
            .on('mouseout', () => {
            highlightEntity(null);
            hideTooltip(tooltip);
        });
        // Dots at vertices
        if (effectiveDotRadius > 0) {
            points.forEach((p, i) => {
                const dim = dimensions[i];
                const val = Number(row[dim]) || 0;
                center.append('circle')
                    .attr('class', 'radar-dot')
                    .attr('data-entity', entity)
                    .attr('cx', p[0])
                    .attr('cy', p[1])
                    .attr('r', effectiveDotRadius)
                    .attr('fill', color)
                    .attr('stroke', DARK_BG)
                    .attr('stroke-width', 1.5)
                    .style('cursor', 'pointer')
                    .on('mouseover', (event) => {
                    highlightEntity(entity);
                    d3.select(event.currentTarget)
                        .attr('r', effectiveDotRadius * 1.5);
                    showTooltip(tooltip, `<strong>${entity}</strong><br/>${dim}: ${formatValue(val)}`, event);
                })
                    .on('mousemove', (event) => {
                    positionTooltip(tooltip, event);
                })
                    .on('mouseout', (event) => {
                    highlightEntity(null);
                    d3.select(event.currentTarget)
                        .attr('r', effectiveDotRadius);
                    hideTooltip(tooltip);
                });
            });
        }
    });
    // ── HTML legend (below chart) with hover highlighting ──
    if (hasLegend) {
        const legendDiv = createLegend(colorScale, { shape: 'circle', callbacks: {
                onHover: (entity) => highlightEntity(entity),
                onLeave: () => highlightEntity(null),
            } });
        container.appendChild(legendDiv);
    }
}
//# sourceMappingURL=radar.js.map