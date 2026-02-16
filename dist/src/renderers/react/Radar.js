import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderRadar } from '../d3/radar.js';
export function Radar({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderRadar, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Radar.js.map