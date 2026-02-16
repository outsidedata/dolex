import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderBullet } from '../d3/comparison/bullet.js';
export function Bullet({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderBullet, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Bullet.js.map