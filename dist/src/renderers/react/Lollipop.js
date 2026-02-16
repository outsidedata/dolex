import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderLollipop } from '../d3/comparison/lollipop.js';
export function Lollipop({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderLollipop, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Lollipop.js.map