/**
 * Statistical helpers shared across distribution renderers.
 *
 * Gaussian KDE, bandwidth selection, quartile computation.
 * Used by violin, ridgeline, density-plot, box-plot.
 */
export interface DensityPoint {
    value: number;
    density: number;
}
/** Compute standard deviation of a numeric array (sample, N-1). */
export declare function stdDev(values: number[]): number;
/** Compute median from sorted values. */
export declare function median(sorted: number[]): number;
/** Compute quartiles + median from sorted values. */
export declare function quartiles(sorted: number[]): {
    q1: number;
    median: number;
    q3: number;
};
/** Gaussian kernel function. */
export declare function gaussianKernel(u: number): number;
/** Silverman's rule of thumb for bandwidth selection. */
export declare function silvermanBandwidth(values: number[]): number;
/** Compute KDE for a set of values at the given sample points. */
export declare function kde(values: number[], samplePoints: number[], bandwidth: number): DensityPoint[];
