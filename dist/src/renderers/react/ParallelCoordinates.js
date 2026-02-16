import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderParallelCoordinates } from '../d3/parallel-coordinates.js';
export function ParallelCoordinates({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderParallelCoordinates, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=ParallelCoordinates.js.map