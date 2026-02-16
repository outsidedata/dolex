import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { connectedDotPlotBundle } from '../_generated/bundles.js';

export function buildConnectedDotPlotHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, connectedDotPlotBundle);
}
