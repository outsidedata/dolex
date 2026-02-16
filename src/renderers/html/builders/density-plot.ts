import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { densityPlotBundle } from '../_generated/bundles.js';

export function buildDensityPlotHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, densityPlotBundle);
}
