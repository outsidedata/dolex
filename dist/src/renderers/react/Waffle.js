import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderWaffle } from '../d3/composition/waffle.js';
export function Waffle({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderWaffle, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Waffle.js.map