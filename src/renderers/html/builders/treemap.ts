import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { treemapBundle } from '../_generated/bundles.js';

export function buildTreemapHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, treemapBundle);
}
