import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { groupedBarBundle } from '../_generated/bundles.js';

export function buildGroupedBarHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, groupedBarBundle);
}
