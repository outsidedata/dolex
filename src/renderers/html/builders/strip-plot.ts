import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { stripPlotBundle } from '../_generated/bundles.js';

export function buildStripPlotHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, stripPlotBundle);
}
