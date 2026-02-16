import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderSmallMultiples } from '../d3/time/small-multiples.js';
export function SmallMultiples({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderSmallMultiples, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=SmallMultiples.js.map