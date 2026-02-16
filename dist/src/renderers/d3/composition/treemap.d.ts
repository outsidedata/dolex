/**
 * Treemap D3 renderer — HTML div-based for proper text wrapping.
 *
 * Uses d3.treemap() for layout computation but renders with absolutely-
 * positioned divs instead of SVG rects, giving us natural CSS text wrapping.
 */
import type { VisualizationSpec } from '../../../types.js';
export declare function renderTreemap(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=treemap.d.ts.map