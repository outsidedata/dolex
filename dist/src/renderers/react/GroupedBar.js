import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderGroupedBar } from '../d3/comparison/grouped-bar.js';
export function GroupedBar({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderGroupedBar, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=GroupedBar.js.map