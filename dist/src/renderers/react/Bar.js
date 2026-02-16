import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderBar } from '../d3/comparison/bar.js';
export function Bar({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderBar, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Bar.js.map