import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { horizonChartBundle } from '../_generated/bundles.js';

export function buildHorizonChartHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, horizonChartBundle);
}
