import { jsx as _jsx } from "react/jsx-runtime";
import { useChart } from './useChart.js';
import { renderChord } from '../d3/flow/chord.js';
export function Chord({ spec, width = 800, height = 500, className, onReady, }) {
    const containerRef = useChart(spec, renderChord, width, height, onReady);
    return _jsx("div", { ref: containerRef, className: className });
}
//# sourceMappingURL=Chord.js.map