import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { marimekkoBundle } from '../_generated/bundles.js';

export function buildMarimekkoHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, marimekkoBundle);
}
