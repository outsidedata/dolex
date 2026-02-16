import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderSlopeChart } from '../d3/comparison/slope-chart.js';
export function SlopeChart({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderSlopeChart, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=SlopeChart.js.map