import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { smallMultiplesBundle } from '../_generated/bundles.js';

export function buildSmallMultiplesHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, smallMultiplesBundle);
}
