/**
 * Flow renderers — sankey.
 *
 * Uses a custom simplified sankey layout since d3-sankey
 * may not be available. The layout computes node positions
 * and link paths from source/target/value data.
 */
import type { VisualizationSpec } from '../../types.js';
export declare function renderSankey(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=flow.d.ts.map