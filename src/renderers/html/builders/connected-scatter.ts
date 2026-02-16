import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { connectedScatterBundle } from '../_generated/bundles.js';

export function buildConnectedScatterHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, connectedScatterBundle);
}
