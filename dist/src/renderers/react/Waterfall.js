import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderWaterfall } from '../d3/comparison/waterfall.js';
export function Waterfall({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderWaterfall, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Waterfall.js.map