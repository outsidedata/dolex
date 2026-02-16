/**
 * Strip plot D3 renderer.
 *
 * Horizontal jitter plot: one quantitative axis (x) with optional categorical
 * grouping (y bands). Dots are jittered vertically within each band.
 *
 * Modeled on the scatter renderer: Delaunay hover, flex legend with
 * interactive highlighting, adaptive dot radius, seeded jitter.
 */
import type { VisualizationSpec } from '../../../types.js';
export declare function renderStripPlot(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=strip-plot.d.ts.map