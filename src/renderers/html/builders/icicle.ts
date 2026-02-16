import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { icicleBundle } from '../_generated/bundles.js';

export function buildIcicleHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, icicleBundle);
}
