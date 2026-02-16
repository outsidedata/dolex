import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { histogramBundle } from '../_generated/bundles.js';

export function buildHistogramHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, histogramBundle);
}
