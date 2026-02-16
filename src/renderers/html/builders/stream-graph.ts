import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { streamGraphBundle } from '../_generated/bundles.js';

export function buildStreamGraphHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, streamGraphBundle);
}
