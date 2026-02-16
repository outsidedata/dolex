/**
 * Shared React hook for D3 chart lifecycle management.
 *
 * Handles ref creation, cleanup, and re-rendering when spec/dimensions change.
 * Each React chart component is a thin wrapper: useRef + useChart + a div.
 */
import type { VisualizationSpec } from '../../types.js';
type D3RenderFn = (container: HTMLElement, spec: VisualizationSpec) => void;
/**
 * Manage a D3 chart inside a React component.
 *
 * @param spec - The VisualizationSpec to render
 * @param renderFn - The D3 render function (e.g., renderBar)
 * @param width - Container width
 * @param height - Container height
 * @param onReady - Optional callback after render
 * @returns A ref to attach to the container div
 */
export declare function useChart(spec: VisualizationSpec, renderFn: D3RenderFn, width: number, height: number, onReady?: (container: HTMLDivElement) => void): React.RefObject<HTMLDivElement | null>;
export {};
//# sourceMappingURL=useChart.d.ts.map