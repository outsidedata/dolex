import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { scatterBundle } from '../_generated/bundles.js';

export function buildScatterHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, scatterBundle);
}
