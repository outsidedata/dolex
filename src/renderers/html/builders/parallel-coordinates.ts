import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { parallelCoordinatesBundle } from '../_generated/bundles.js';

export function buildParallelCoordinatesHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, parallelCoordinatesBundle);
}
