import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderScatter } from '../d3/relationship.js';
export function Scatter({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderScatter, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Scatter.js.map