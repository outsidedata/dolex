/**
 * Shared crosshair hover utilities for time-series renderers.
 * Extracts the duplicated bisector + crosshair element creation pattern
 * used by line, area, stream-graph, and horizon-chart renderers.
 */
/**
 * Find the index of the nearest date in a sorted array of timestamps.
 * Uses d3.bisector to find the insertion point, then picks the closer neighbor.
 */
export declare function findNearestDateIndex(sortedDates: number[], targetTime: number): number;
/**
 * Create the standard crosshair SVG elements: vertical line, highlight dots group,
 * and invisible hover rect for mouse events.
 *
 * Returns the three elements so the caller can wire up mousemove/mouseout handlers.
 */
export declare function createCrosshairGroup(g: any, dims: {
    innerWidth: number;
    innerHeight: number;
}): {
    crosshairLine: any;
    highlightDots: any;
    hoverArea: any;
};
