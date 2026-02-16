import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { lineBundle } from '../_generated/bundles.js';

export function buildLineHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, lineBundle);
}
