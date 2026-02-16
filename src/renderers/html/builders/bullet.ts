import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { bulletBundle } from '../_generated/bundles.js';

export function buildBulletHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, bulletBundle);
}
