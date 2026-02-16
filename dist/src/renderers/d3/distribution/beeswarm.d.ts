/**
 * Beeswarm chart D3 renderer.
 *
 * Horizontal dodge layout: one quantitative axis (x) with optional categorical
 * grouping (y bands). Dots are dodge-positioned to avoid overlap while showing
 * distribution shape (unlike strip-plot which uses random jitter).
 *
 * Modeled on the strip-plot renderer: Delaunay hover, flex legend with
 * interactive highlighting, adaptive dot radius, instant rendering.
 */
import type { VisualizationSpec } from '../../../types.js';
export declare function renderBeeswarm(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=beeswarm.d.ts.map