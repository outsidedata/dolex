import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderFunnel } from '../d3/flow/funnel.js';
export function Funnel({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderFunnel, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Funnel.js.map