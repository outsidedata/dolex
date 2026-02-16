import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderConnectedScatter } from '../d3/connected-scatter.js';
export function ConnectedScatter({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderConnectedScatter, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=ConnectedScatter.js.map