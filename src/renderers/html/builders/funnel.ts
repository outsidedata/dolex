import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { funnelBundle } from '../_generated/bundles.js';

export function buildFunnelHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, funnelBundle);
}
