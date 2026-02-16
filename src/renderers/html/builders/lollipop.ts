import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { lollipopBundle } from '../_generated/bundles.js';

export function buildLollipopHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, lollipopBundle);
}
