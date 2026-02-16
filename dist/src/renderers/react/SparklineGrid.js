import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderSparklineGrid } from '../d3/time/sparkline-grid.js';
export function SparklineGrid({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderSparklineGrid, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=SparklineGrid.js.map