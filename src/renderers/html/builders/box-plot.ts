import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { boxPlotBundle } from '../_generated/bundles.js';

export function buildBoxPlotHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, boxPlotBundle);
}
