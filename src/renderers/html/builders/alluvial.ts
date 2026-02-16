import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { alluvialBundle } from '../_generated/bundles.js';

export function buildAlluvialHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, alluvialBundle);
}
