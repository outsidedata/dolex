import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderMarimekko } from '../d3/composition/marimekko.js';
export function Marimekko({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderMarimekko, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Marimekko.js.map