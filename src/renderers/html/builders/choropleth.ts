import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { choroplethBundle } from '../_generated/bundles.js';

export function buildChoroplethHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, choroplethBundle);
}
