import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { metricBundle } from '../_generated/bundles.js';

export function buildMetricHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, metricBundle);
}
