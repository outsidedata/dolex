import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderAlluvial } from '../d3/flow/alluvial.js';
export function Alluvial({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderAlluvial, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Alluvial.js.map