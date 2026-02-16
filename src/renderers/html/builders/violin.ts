import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { violinBundle } from '../_generated/bundles.js';

export function buildViolinHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, violinBundle);
}
