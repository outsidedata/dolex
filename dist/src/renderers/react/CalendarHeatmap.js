import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderCalendarHeatmap } from '../d3/time/calendar-heatmap.js';
export function CalendarHeatmap({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderCalendarHeatmap, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=CalendarHeatmap.js.map