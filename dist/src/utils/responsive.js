/**
 * Responsive Utilities — adaptive sizing for different container dimensions.
 *
 * Provides container-aware breakpoints, margin calculations, font sizing,
 * and tick count recommendations so charts look good at any size.
 */
/**
 * Determine the container mode based on width and height.
 *
 * @param width - Container width in pixels
 * @param height - Container height in pixels (optional)
 * @returns The container mode
 */
export function getContainerMode(width, height) {
    if (width < 320)
        return 'compact';
    if (width < 600)
        return 'default';
    if (width < 1000)
        return 'wide';
    return 'large';
}
/**
 * Calculate responsive margins based on container dimensions.
 *
 * Smaller containers get tighter margins to maximize chart area.
 * Larger containers get roomier margins for labels and legends.
 *
 * @param width - Container width in pixels
 * @param height - Container height in pixels
 * @param options - Optional overrides
 * @returns Calculated margins
 */
export function responsiveMargins(width, height, options) {
    const mode = getContainerMode(width);
    const opts = options ?? {};
    const base = {
        compact: { top: 24, right: 12, bottom: 30, left: 36 },
        default: { top: 36, right: 24, bottom: 44, left: 52 },
        wide: { top: 40, right: 30, bottom: 50, left: 60 },
        large: { top: 48, right: 40, bottom: 56, left: 70 },
    };
    const m = { ...base[mode] };
    if (opts.hasTitle)
        m.top += mode === 'compact' ? 8 : 12;
    if (opts.hasXLabel)
        m.bottom += mode === 'compact' ? 10 : 16;
    if (opts.hasYLabel)
        m.left += mode === 'compact' ? 10 : 16;
    if (opts.hasLegend)
        m.right += mode === 'compact' ? 40 : 80;
    return m;
}
// ─── RESPONSIVE FONT SIZE ────────────────────────────────────────────────────
/**
 * Calculate responsive font size based on container width.
 *
 * @param width - Container width in pixels
 * @param role - The text role determining base size
 * @returns Font size in pixels
 */
export function responsiveFontSize(width, role = 'tickLabel') {
    const mode = getContainerMode(width);
    const sizes = {
        title: { compact: 11, default: 13, wide: 14, large: 16 },
        axisLabel: { compact: 9, default: 11, wide: 12, large: 13 },
        tickLabel: { compact: 8, default: 10, wide: 11, large: 12 },
        annotation: { compact: 8, default: 10, wide: 11, large: 12 },
        legend: { compact: 8, default: 10, wide: 11, large: 11 },
    };
    return sizes[role][mode];
}
// ─── RESPONSIVE TICKS ────────────────────────────────────────────────────────
/**
 * Calculate the recommended number of axis ticks based on available axis length.
 *
 * @param axisLength - Length of the axis in pixels
 * @param isCategory - Whether this is a categorical (band) axis
 * @returns Recommended tick count
 */
export function responsiveTicks(axisLength, isCategory = false) {
    if (isCategory) {
        // For categories, show every label up to a threshold, then skip
        const maxVisible = Math.floor(axisLength / 60);
        return Math.max(2, maxVisible);
    }
    // Quantitative/temporal: target ~80px per tick
    const tickCount = Math.max(2, Math.floor(axisLength / 80));
    return Math.min(tickCount, 12);
}
//# sourceMappingURL=responsive.js.map