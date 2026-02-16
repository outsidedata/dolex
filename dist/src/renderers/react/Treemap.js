import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderTreemap } from '../d3/composition/treemap.js';
export function Treemap({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderTreemap, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Treemap.js.map