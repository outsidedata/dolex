import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { ridgelineBundle } from '../_generated/bundles.js';

export function buildRidgelineHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, ridgelineBundle);
}
