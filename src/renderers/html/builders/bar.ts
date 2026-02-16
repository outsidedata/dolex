import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { barBundle } from '../_generated/bundles.js';

export function buildBarHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, barBundle);
}
