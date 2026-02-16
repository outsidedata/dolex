import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { chordBundle } from '../_generated/bundles.js';

export function buildChordHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, chordBundle);
}
