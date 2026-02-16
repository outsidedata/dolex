import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderSankey } from '../d3/flow/sankey.js';
export function Sankey({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderSankey, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Sankey.js.map