import { jsx as _jsx } from "react/jsx-runtime";
/**
 * React component for the Choropleth Map pattern.
 * Uses the HTML builder via a sandboxed iframe.
 */
import { useMemo } from 'react';
import { buildChoroplethHtml } from '../html/builders/choropleth.js';
export function Choropleth({ spec, width = 800, height = 500, className, onReady, }) {
    const srcDoc = useMemo(() => buildChoroplethHtml(spec), [spec]);
    return (_jsx("iframe", { srcDoc: srcDoc, width: width, height: height, className: className, title: spec.title || 'Choropleth Map', style: { border: 'none', display: 'block' }, sandbox: "allow-scripts", ref: (el) => {
            if (el && onReady) {
                el.addEventListener('load', () => onReady(el), { once: true });
            }
        } }));
}
//# sourceMappingURL=Choropleth.js.map