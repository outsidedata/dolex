import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderHeatmap } from '../d3/heatmap.js';
export function Heatmap({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderHeatmap, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Heatmap.js.map