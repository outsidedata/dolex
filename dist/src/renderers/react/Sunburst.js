import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderSunburst } from '../d3/composition/sunburst.js';
export function Sunburst({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderSunburst, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Sunburst.js.map