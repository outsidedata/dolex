import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { sparklineGridBundle } from '../_generated/bundles.js';

export function buildSparklineGridHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, sparklineGridBundle);
}
