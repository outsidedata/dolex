import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderBoxPlot } from '../d3/distribution/box-plot.js';
export function BoxPlot({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderBoxPlot, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=BoxPlot.js.map