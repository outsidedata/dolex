import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { waterfallBundle } from '../_generated/bundles.js';

export function buildWaterfallHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, waterfallBundle);
}
