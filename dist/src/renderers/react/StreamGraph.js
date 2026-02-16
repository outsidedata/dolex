import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderStreamGraph } from '../d3/time/stream-graph.js';
export function StreamGraph({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderStreamGraph, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=StreamGraph.js.map