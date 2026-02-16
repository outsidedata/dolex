import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderConnectedDotPlot } from '../d3/comparison/connected-dot-plot.js';
export function ConnectedDotPlot({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderConnectedDotPlot, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=ConnectedDotPlot.js.map