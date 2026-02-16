import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { proportionalSymbolBundle } from '../_generated/bundles.js';

export function buildProportionalSymbolHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, proportionalSymbolBundle);
}
