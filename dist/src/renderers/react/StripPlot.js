import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderStripPlot } from '../d3/distribution/strip-plot.js';
export function StripPlot({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderStripPlot, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=StripPlot.js.map