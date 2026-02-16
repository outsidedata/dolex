/**
 * Sunburst D3 renderer.
 *
 * Concentric rings from hierarchical data. Inner ring = top-level categories,
 * outer rings = deeper levels. Each node is an arc segment.
 *
 * Layout: flex column — title (HTML) → SVG chart → HTML legend.
 */
import type { VisualizationSpec } from '../../../types.js';
export declare function renderSunburst(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=sunburst.d.ts.map