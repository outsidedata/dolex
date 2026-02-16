import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { sunburstBundle } from '../_generated/bundles.js';

export function buildSunburstHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, sunburstBundle);
}
