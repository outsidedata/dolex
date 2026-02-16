import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderMetric } from '../d3/composition/metric.js';
export function Metric({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderMetric, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Metric.js.map