import { buildHtmlFromBundle } from '../template.js';
import { calendarHeatmapBundle } from '../_generated/bundles.js';
export function buildCalendarHeatmapHtml(spec) {
    return buildHtmlFromBundle(spec, calendarHeatmapBundle);
}
