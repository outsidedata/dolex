import type { VisualizationSpec } from '../../../types.js';
import { buildHtmlFromBundle } from '../template.js';
import { calendarHeatmapBundle } from '../_generated/bundles.js';

export function buildCalendarHeatmapHtml(spec: VisualizationSpec): string {
  return buildHtmlFromBundle(spec, calendarHeatmapBundle);
}
