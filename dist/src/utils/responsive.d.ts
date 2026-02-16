/**
 * Responsive Utilities — adaptive sizing for different container dimensions.
 *
 * Provides container-aware breakpoints, margin calculations, font sizing,
 * and tick count recommendations so charts look good at any size.
 */
export type ContainerMode = 'compact' | 'default' | 'wide' | 'large';
/**
 * Determine the container mode based on width and height.
 *
 * @param width - Container width in pixels
 * @param height - Container height in pixels (optional)
 * @returns The container mode
 */
export declare function getContainerMode(width: number, height?: number): ContainerMode;
export interface ChartMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
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
export declare function responsiveMargins(width: number, height: number, options?: {
    hasTitle?: boolean;
    hasXLabel?: boolean;
    hasYLabel?: boolean;
    hasLegend?: boolean;
}): ChartMargins;
/**
 * Calculate responsive font size based on container width.
 *
 * @param width - Container width in pixels
 * @param role - The text role determining base size
 * @returns Font size in pixels
 */
export declare function responsiveFontSize(width: number, role?: 'title' | 'axisLabel' | 'tickLabel' | 'annotation' | 'legend'): number;
/**
 * Calculate the recommended number of axis ticks based on available axis length.
 *
 * @param axisLength - Length of the axis in pixels
 * @param isCategory - Whether this is a categorical (band) axis
 * @returns Recommended tick count
 */
export declare function responsiveTicks(axisLength: number, isCategory?: boolean): number;
//# sourceMappingURL=responsive.d.ts.map