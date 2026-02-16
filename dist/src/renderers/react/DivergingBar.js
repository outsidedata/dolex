import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderDivergingBar } from '../d3/comparison/diverging-bar.js';
export function DivergingBar({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderDivergingBar, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=DivergingBar.js.map