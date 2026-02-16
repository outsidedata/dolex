import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderDensityPlot } from '../d3/distribution/density-plot.js';
export function DensityPlot({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderDensityPlot, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=DensityPlot.js.map