import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { heatmapBundle } from '../_generated/bundles.js';

export function buildHeatmapHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, heatmapBundle);
}
