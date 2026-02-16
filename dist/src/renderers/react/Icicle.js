import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderIcicle } from '../d3/composition/icicle.js';
export function Icicle({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderIcicle, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Icicle.js.map