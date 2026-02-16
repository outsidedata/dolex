/**
 * Shared React hook for D3 chart lifecycle management.
 *
 * Handles ref creation, cleanup, and re-rendering when spec/dimensions change.
 * Each React chart component is a thin wrapper: useRef + useChart + a div.
 */
import { useRef, useEffect } from 'react';
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
export function useChart(spec, renderFn, width, height, onReady) {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
        // Set dimensions so D3 can read clientWidth/clientHeight
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        // Clear and render
        container.innerHTML = '';
        try {
            renderFn(container, spec);
        }
        catch (err) {
            console.error(`[Dolex] Render error for "${spec.pattern}":`, err);
            container.innerHTML = `<p style="color:#ef4444;padding:20px;">Render error: ${err.message}</p>`;
        }
        onReady?.(container);
        // Cleanup on unmount
        return () => {
            if (container)
                container.innerHTML = '';
        };
    }, [spec, renderFn, width, height, onReady]);
    return containerRef;
}
//# sourceMappingURL=useChart.js.map