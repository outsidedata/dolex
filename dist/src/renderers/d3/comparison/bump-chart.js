/**
 * Bump chart D3 renderer.
 *
 * Shows rankings over time. X-axis is time periods (ordinal),
 * Y-axis is rank (1 at top, inverted). Each entity is a smooth
 * line connecting its rank at each time period.
 */
import { createSvg, buildColorScale, createLegend, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, TEXT_MUTED, GRID_COLOR, DARK_BG, truncateLabel, } from '../shared.js';
export function renderBumpChart(container, spec) {
    const { config, encoding, data } = spec;
    const categoryField = config.categoryField || encoding.color?.field || 'entity';
    const timeField = config.timeField || encoding.x?.field || 'period';
    const valueField = config.valueField || encoding.y?.field || 'value';
    const showLabels = config.showLabels !== false;
    const strokeWidth = config.strokeWidth ?? 2.5;
    const dotRadius = config.dotRadius ?? 5;
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.background = DARK_BG;
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    const chartWrapper = document.createElement('div');
    chartWrapper.style.flex = '1';
    chartWrapper.style.minHeight = '0';
    container.appendChild(chartWrapper);
    const { svg, g, dims } = createSvg(chartWrapper, spec, { left: 40, right: 100 });
    svg.style('background', 'none').style('border-radius', '0');
    const tooltip = createTooltip(container);
    // Extract unique entities and periods (preserve data order for periods)
    const periodSet = new Set();
    data.forEach((d) => periodSet.add(String(d[timeField])));
    const periods = [...periodSet];
    const entitySet = new Set();
    data.forEach((d) => entitySet.add(String(d[categoryField])));
    const entities = [...entitySet];
    // Build a lookup: entity -> period -> value
    const lookup = {};
    entities.forEach((e) => {
        lookup[e] = {};
    });
    data.forEach((d) => {
        const e = String(d[categoryField]);
        const p = String(d[timeField]);
        lookup[e][p] = Number(d[valueField]);
    });
    // Compute ranks: for each period, sort entities by value descending, assign rank 1,2,3...
    const ranks = {};
    entities.forEach((e) => {
        ranks[e] = {};
    });
    periods.forEach((period) => {
        const entitiesWithValues = entities
            .filter((e) => lookup[e][period] != null && !isNaN(lookup[e][period]))
            .map((e) => ({ entity: e, value: lookup[e][period] }));
        entitiesWithValues.sort((a, b) => b.value - a.value);
        entitiesWithValues.forEach((item, idx) => {
            ranks[item.entity][period] = idx + 1;
        });
    });
    const maxRank = entities.length;
    // Scales
    const xScale = d3
        .scalePoint()
        .domain(periods)
        .range([0, dims.innerWidth])
        .padding(0.5);
    const yScale = d3
        .scaleLinear()
        .domain([1, maxRank])
        .range([20, dims.innerHeight - 20]);
    const colorScale = buildColorScale(encoding.color, data);
    // Draw faint horizontal gridlines at each rank
    for (let rank = 1; rank <= maxRank; rank++) {
        g.append('line')
            .attr('x1', 0)
            .attr('y1', yScale(rank))
            .attr('x2', dims.innerWidth)
            .attr('y2', yScale(rank))
            .attr('stroke', GRID_COLOR)
            .attr('stroke-width', 0.5)
            .attr('stroke-dasharray', '3,3');
        // Rank labels on left
        g.append('text')
            .attr('x', -8)
            .attr('y', yScale(rank))
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '10px')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(`#${rank}`);
    }
    // Period labels along x-axis
    periods.forEach((period) => {
        g.append('text')
            .attr('x', xScale(period))
            .attr('y', dims.innerHeight + 20)
            .attr('text-anchor', 'middle')
            .attr('fill', TEXT_MUTED)
            .attr('font-size', '11px')
            .attr('font-weight', '500')
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .text(String(period));
    });
    // Draw lines and dots for each entity
    const isSinglePeriod = periods.length <= 1;
    if (!isSinglePeriod) {
        const line = d3
            .line()
            .x((d) => xScale(d.period))
            .y((d) => yScale(d.rank))
            .curve(d3.curveBumpX);
        entities.forEach((entity) => {
            const points = periods
                .filter((p) => ranks[entity][p] != null)
                .map((p) => ({
                period: p,
                rank: ranks[entity][p],
                value: lookup[entity][p],
            }));
            if (points.length < 2)
                return;
            const color = colorScale(entity);
            g.append('path')
                .datum(points)
                .attr('d', line)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', strokeWidth)
                .attr('opacity', 0.8);
            points.forEach((pt) => {
                g.append('circle')
                    .attr('cx', xScale(pt.period))
                    .attr('cy', yScale(pt.rank))
                    .attr('r', dotRadius)
                    .attr('fill', color)
                    .attr('stroke', DARK_BG)
                    .attr('stroke-width', 2)
                    .attr('cursor', 'pointer')
                    .on('mouseover', function (event) {
                    d3.select(this).attr('r', dotRadius + 2);
                    showTooltip(tooltip, `<strong>${entity}</strong><br/>Period: ${pt.period}<br/>Rank: #${pt.rank}<br/>Value: ${formatValue(pt.value)}`, event);
                })
                    .on('mousemove', (event) => {
                    positionTooltip(tooltip, event);
                })
                    .on('mouseout', function () {
                    d3.select(this).attr('r', dotRadius);
                    hideTooltip(tooltip);
                });
            });
            if (showLabels) {
                const lastPt = points[points.length - 1];
                g.append('text')
                    .attr('x', xScale(lastPt.period) + dotRadius + 6)
                    .attr('y', yScale(lastPt.rank))
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', color)
                    .attr('font-size', '11px')
                    .attr('font-weight', '500')
                    .attr('font-family', 'Inter, system-ui, sans-serif')
                    .text(truncateLabel(entity, 14));
            }
        });
    }
    else {
        const singlePeriod = periods[0];
        const dotX = dims.innerWidth / 2;
        entities.forEach((entity) => {
            const rank = ranks[entity][singlePeriod];
            if (rank == null)
                return;
            const value = lookup[entity][singlePeriod];
            const color = colorScale(entity);
            g.append('circle')
                .attr('cx', dotX)
                .attr('cy', yScale(rank))
                .attr('r', 6)
                .attr('fill', color)
                .attr('stroke', DARK_BG)
                .attr('stroke-width', 2)
                .attr('cursor', 'pointer')
                .on('mouseover', function (event) {
                d3.select(this).attr('r', 8);
                showTooltip(tooltip, `<strong>${entity}</strong><br/>Period: ${singlePeriod}<br/>Rank: #${rank}<br/>Value: ${formatValue(value)}`, event);
            })
                .on('mousemove', (event) => {
                positionTooltip(tooltip, event);
            })
                .on('mouseout', function () {
                d3.select(this).attr('r', 6);
                hideTooltip(tooltip);
            });
            g.append('text')
                .attr('x', dotX + 12)
                .attr('y', yScale(rank))
                .attr('dominant-baseline', 'middle')
                .attr('fill', color)
                .attr('font-size', '11px')
                .attr('font-weight', '500')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(`${entity.length > 14 ? entity.slice(0, 13) + '\u2026' : entity} (${formatValue(value)})`);
        });
    }
    if (!showLabels) {
        const legendDiv = createLegend(colorScale);
        container.appendChild(legendDiv);
    }
}
//# sourceMappingURL=bump-chart.js.map