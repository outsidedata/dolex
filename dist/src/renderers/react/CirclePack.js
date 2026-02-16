import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderCirclePack } from '../d3/composition/circle-pack.js';
export function CirclePack({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderCirclePack, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=CirclePack.js.map