import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { divergingBarBundle } from '../_generated/bundles.js';

export function buildDivergingBarHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, divergingBarBundle);
}
