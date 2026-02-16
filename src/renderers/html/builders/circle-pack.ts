import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { circlePackBundle } from '../_generated/bundles.js';

export function buildCirclePackHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, circlePackBundle);
}
