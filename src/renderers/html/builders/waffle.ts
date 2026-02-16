import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { waffleBundle } from '../_generated/bundles.js';

export function buildWaffleHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, waffleBundle);
}
