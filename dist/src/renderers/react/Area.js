import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderArea } from '../d3/time/area.js';
export function Area({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderArea, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Area.js.map