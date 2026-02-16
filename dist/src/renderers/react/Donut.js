import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderDonut } from '../d3/composition/donut.js';
export function Donut({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderDonut, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Donut.js.map