import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { beeswarmBundle } from '../_generated/bundles.js';

export function buildBeeswarmHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, beeswarmBundle);
}
