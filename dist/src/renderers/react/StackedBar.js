import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderStackedBar } from '../d3/composition/stacked-bar.js';
export function StackedBar({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderStackedBar, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=StackedBar.js.map