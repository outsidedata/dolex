import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { donutBundle } from '../_generated/bundles.js';

export function buildDonutHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, donutBundle);
}
