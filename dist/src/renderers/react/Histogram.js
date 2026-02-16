import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderHistogram } from '../d3/distribution/histogram.js';
export function Histogram({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderHistogram, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Histogram.js.map