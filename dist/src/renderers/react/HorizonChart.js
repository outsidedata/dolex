import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderHorizonChart } from '../d3/time/horizon-chart.js';
export function HorizonChart({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderHorizonChart, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=HorizonChart.js.map