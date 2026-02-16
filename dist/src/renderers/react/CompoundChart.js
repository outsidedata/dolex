import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * React component for compound visualizations.
 *
 * Renders multiple views (chart + table) in a CSS grid layout
 * with linked interaction state.
 */
import { useState, useCallback, useMemo } from 'react';
import { DataTable } from './DataTable.js';
export function CompoundChart({ spec, width = 1200, height = 800, className, chartComponents = {}, }) {
    const [highlightRow, setHighlightRow] = useState(null);
    const highlightFields = useMemo(() => {
        return (spec.interactions || [])
            .filter(i => i.type === 'highlight')
            .map(i => i.field);
    }, [spec.interactions]);
    const handleHighlight = useCallback((row) => {
        setHighlightRow(row);
    }, []);
    const handleClearHighlight = useCallback(() => {
        setHighlightRow(null);
    }, []);
    const layout = spec.layout || { type: 'rows' };
    const sizes = layout.sizes || spec.views.map(v => v.type === 'chart' ? 3 : 2);
    const gap = layout.gap || 12;
    const gridStyle = {
        width,
        height,
        display: 'grid',
        gap,
        padding: gap,
        background: '#0f1117',
        borderRadius: 8,
        ...(layout.type === 'columns'
            ? { gridTemplateColumns: sizes.map(s => s + 'fr').join(' '), gridTemplateRows: '1fr' }
            : { gridTemplateRows: sizes.map(s => s + 'fr').join(' '), gridTemplateColumns: '1fr' }),
    };
    // Calculate view dimensions based on layout
    const viewDimensions = useMemo(() => {
        const totalSize = sizes.reduce((a, b) => a + b, 0);
        const innerGap = gap * (sizes.length + 1);
        return sizes.map(s => {
            const fraction = s / totalSize;
            if (layout.type === 'columns') {
                return {
                    width: Math.floor((width - innerGap) * fraction),
                    height: height - gap * 2,
                };
            }
            return {
                width: width - gap * 2,
                height: Math.floor((height - innerGap) * fraction),
            };
        });
    }, [width, height, sizes, gap, layout.type]);
    function renderView(view, index) {
        const dims = viewDimensions[index];
        if (view.type === 'chart' && view.chart) {
            const ChartComp = chartComponents[view.chart.pattern];
            if (ChartComp) {
                const fullSpec = {
                    ...view.chart,
                    data: spec.data,
                };
                return (_jsx("div", { style: { minHeight: 0, minWidth: 0, overflow: 'hidden' }, children: _jsx(ChartComp, { spec: fullSpec, width: dims.width, height: dims.height }) }, view.id));
            }
            // Fallback: show pattern name
            return (_jsxs("div", { style: {
                    minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#6b7280', fontSize: 14,
                }, children: ["Chart: ", view.chart.pattern, " (component not provided)"] }, view.id));
        }
        if (view.type === 'table') {
            return (_jsx(DataTable, { data: spec.data, tableSpec: view.table, width: dims.width, height: dims.height, highlightRow: highlightRow, highlightFields: highlightFields, onHighlight: handleHighlight, onClearHighlight: handleClearHighlight }, view.id));
        }
        return null;
    }
    return (_jsx("div", { style: gridStyle, className: className, children: spec.views.map((view, i) => renderView(view, i)) }));
}
//# sourceMappingURL=CompoundChart.js.map