import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { stackedBarBundle } from '../_generated/bundles.js';

export function buildStackedBarHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, stackedBarBundle);
}
