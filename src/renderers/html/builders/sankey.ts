import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { sankeyBundle } from '../_generated/bundles.js';

export function buildSankeyHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, sankeyBundle);
}
