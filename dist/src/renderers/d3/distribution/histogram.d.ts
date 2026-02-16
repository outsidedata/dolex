/**
 * Histogram D3 renderer — bins continuous values and shows frequency.
 *
 * Supports two data modes:
 *   1. Raw data: rows with a numeric field → d3.bin() computes bins
 *   2. Pre-binned: rows with binStart/binEnd/count fields
 *
 * Optional stat overlays: mean line, median line.
 */
import type { VisualizationSpec } from '../../../types.js';
export declare function renderHistogram(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=histogram.d.ts.map