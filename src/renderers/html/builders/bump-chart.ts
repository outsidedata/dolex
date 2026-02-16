import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { bumpChartBundle } from '../_generated/bundles.js';

export function buildBumpChartHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, bumpChartBundle);
}
