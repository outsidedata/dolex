import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderBeeswarm } from '../d3/distribution/beeswarm.js';
export function Beeswarm({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderBeeswarm, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Beeswarm.js.map