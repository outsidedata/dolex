/**
 * Compound visualization logic.
 *
 * Decides whether to wrap a chart spec with companion views (table, etc.)
 * and builds the CompoundVisualizationSpec.
 */
import type { VisualizationSpec, CompoundVisualizationSpec, DataColumn } from '../../types.js';
/**
 * Decide whether a chart should be wrapped in a compound visualization.
 */
export declare function shouldCompound(spec: VisualizationSpec, options?: {
    compound?: boolean;
}): boolean;
/**
 * Build a CompoundVisualizationSpec wrapping a chart with a data table.
 */
export declare function buildCompoundSpec(spec: VisualizationSpec, columns?: DataColumn[]): CompoundVisualizationSpec;
//# sourceMappingURL=compound.d.ts.map