import { jsx as _jsx } from "react/jsx-runtime";
/**
 * React component for the Proportional Symbol Map pattern.
 * Uses the HTML builder via a sandboxed iframe.
 */
import { useMemo } from 'react';
import { buildProportionalSymbolHtml } from '../html/builders/proportional-symbol.js';
export function ProportionalSymbol({ spec, width = 800, height = 500, className, onReady, }) {
    const srcDoc = useMemo(() => buildProportionalSymbolHtml(spec), [spec]);
    return (_jsx("iframe", { srcDoc: srcDoc, width: width, height: height, className: className, title: spec.title || 'Proportional Symbol Map', style: { border: 'none', display: 'block' }, sandbox: "allow-scripts", ref: (el) => {
            if (el && onReady) {
                el.addEventListener('load', () => onReady(el), { once: true });
            }
        } }));
}
//# sourceMappingURL=ProportionalSymbol.js.map