/**
 * Statistical helpers shared across distribution renderers.
 *
 * Gaussian KDE, bandwidth selection, quartile computation.
 * Used by violin, ridgeline, density-plot, box-plot.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface DensityPoint {
  value: number;
  density: number;
}

// ─── DESCRIPTIVE STATS ──────────────────────────────────────────────────────

/** Compute standard deviation of a numeric array (sample, N-1). */
export function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 1;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/** Compute median from sorted values. */
export function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/** Compute quartiles + median from sorted values. */
export function quartiles(sorted: number[]): { q1: number; median: number; q3: number } {
  const n = sorted.length;
  if (n === 0) return { q1: 0, median: 0, q3: 0 };
  if (n === 1) return { q1: sorted[0], median: sorted[0], q3: sorted[0] };
  const med = median(sorted);
  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));
  const q1 = median(lowerHalf);
  const q3 = median(upperHalf);
  return { q1, median: med, q3 };
}

// ─── KDE ────────────────────────────────────────────────────────────────────

/** Gaussian kernel function. */
export function gaussianKernel(u: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * u * u);
}

/** Silverman's rule of thumb for bandwidth selection. */
export function silvermanBandwidth(values: number[]): number {
  const sd = stdDev(values);
  const n = values.length;
  const bw = 1.06 * sd * Math.pow(n, -0.2);
  if (bw > 0) return bw;
  const range = Math.max(...values) - Math.min(...values);
  return range > 0 ? range * 0.1 : 1;
}

/** Compute KDE for a set of values at the given sample points. */
export function kde(
  values: number[],
  samplePoints: number[],
  bandwidth: number
): DensityPoint[] {
  const n = values.length;
  if (n === 0) return samplePoints.map((x) => ({ value: x, density: 0 }));
  return samplePoints.map((x) => {
    const density =
      values.reduce((sum, xi) => sum + gaussianKernel((x - xi) / bandwidth), 0) /
      (n * bandwidth);
    return { value: x, density };
  });
}
