/**
 * Shared crosshair hover utilities for time-series renderers.
 * Extracts the duplicated bisector + crosshair element creation pattern
 * used by line, area, stream-graph, and horizon-chart renderers.
 */
import { TEXT_MUTED } from '../shared.js';
/**
 * Find the index of the nearest date in a sorted array of timestamps.
 * Uses d3.bisector to find the insertion point, then picks the closer neighbor.
 */
export function findNearestDateIndex(sortedDates, targetTime) {
    const bisect = d3.bisector((d) => d).left;
    let idx = bisect(sortedDates, targetTime);
    if (idx > 0 && idx < sortedDates.length) {
        const d0 = sortedDates[idx - 1];
        const d1 = sortedDates[idx];
        idx = targetTime - d0 > d1 - targetTime ? idx : idx - 1;
    }
    else if (idx >= sortedDates.length) {
        idx = sortedDates.length - 1;
    }
    return idx;
}
/**
 * Create the standard crosshair SVG elements: vertical line, highlight dots group,
 * and invisible hover rect for mouse events.
 *
 * Returns the three elements so the caller can wire up mousemove/mouseout handlers.
 */
export function createCrosshairGroup(g, dims) {
    const crosshairLine = g.append('line')
        .attr('class', 'crosshair')
        .attr('y1', 0)
        .attr('y2', dims.innerHeight)
        .attr('stroke', TEXT_MUTED)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3')
        .attr('pointer-events', 'none')
        .attr('opacity', 0);
    const highlightDots = g.append('g')
        .attr('class', 'highlight-dots')
        .attr('pointer-events', 'none');
    const hoverArea = g.append('rect')
        .attr('class', 'hover-area')
        .attr('width', dims.innerWidth)
        .attr('height', dims.innerHeight)
        .attr('fill', 'transparent')
        .attr('cursor', 'crosshair');
    return { crosshairLine, highlightDots, hoverArea };
}
