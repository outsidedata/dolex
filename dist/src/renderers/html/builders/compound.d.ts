/**
 * Self-contained HTML builder for compound visualizations.
 *
 * Produces a single HTML document with:
 * - CSS grid layout for multiple views
 * - Chart view delegating to existing pattern renderers
 * - Data table view with sort, hover, and formatting
 * - Interaction bus wiring linked highlights between views
 */
import type { CompoundVisualizationSpec } from '../../../types.js';
/**
 * Build a self-contained HTML document for a compound visualization.
 *
 * Embeds the chart view (via iframe srcdoc from the existing builder) and
 * the table view in a CSS grid layout with interaction wiring.
 */
export declare function buildCompoundHtml(spec: CompoundVisualizationSpec): string;
//# sourceMappingURL=compound.d.ts.map