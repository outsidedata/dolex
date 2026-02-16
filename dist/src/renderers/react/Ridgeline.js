import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderRidgeline } from '../d3/distribution/ridgeline.js';
export function Ridgeline({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderRidgeline, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Ridgeline.js.map