import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderLine } from '../d3/time/line.js';
export function Line({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderLine, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Line.js.map