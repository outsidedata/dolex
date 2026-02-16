import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { radarBundle } from '../_generated/bundles.js';

export function buildRadarHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, radarBundle);
}
