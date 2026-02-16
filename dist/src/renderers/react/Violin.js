import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderViolin } from '../d3/distribution/violin.js';
export function Violin({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderViolin, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Violin.js.map