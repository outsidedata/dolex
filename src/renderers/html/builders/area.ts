import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { areaBundle } from '../_generated/bundles.js';

export function buildAreaHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, areaBundle);
}
