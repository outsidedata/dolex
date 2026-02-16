/**
 * Parallel Coordinates D3 renderer.
 *
 * Multiple vertical axes evenly spaced. Each data row draws a polyline
 * connecting its value on each axis. Lines can be colored by a categorical
 * grouping field. Best for comparing multivariate data across many dimensions.
 *
 * Standards: HTML legend below SVG, line-level hover, adaptive tick counts.
 */
import type { VisualizationSpec } from '../../types.js';
export declare function renderParallelCoordinates(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=parallel-coordinates.d.ts.map