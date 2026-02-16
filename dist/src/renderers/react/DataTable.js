import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * React component for the data table view in compound visualizations.
 *
 * Sortable, hoverable table with dark theme styling.
 * Participates in interaction linking via highlight/onHighlight props.
 */
import { useState, useMemo, useCallback } from 'react';
export function DataTable({ data, tableSpec, width, height, className, highlightRow, highlightFields = [], onHighlight, onClearHighlight, }) {
    const [sortState, setSortState] = useState(tableSpec?.sort || null);
    // Auto-detect columns and numeric fields
    const { columns, numericFields } = useMemo(() => {
        let cols = tableSpec?.columns || [];
        if (cols.length === 0 && data.length > 0) {
            cols = Object.keys(data[0]).map(k => ({ field: k, title: k }));
        }
        const numFields = new Set();
        if (data.length > 0) {
            cols.forEach(col => {
                const sample = data.slice(0, 10).map(d => d[col.field]);
                const numCount = sample.filter(v => v != null && (typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))).length;
                if (numCount > sample.length * 0.7)
                    numFields.add(col.field);
            });
        }
        return { columns: cols, numericFields: numFields };
    }, [data, tableSpec?.columns]);
    // Sort data
    const sortedData = useMemo(() => {
        const sorted = [...data];
        if (!sortState)
            return sorted;
        const { field, direction } = sortState;
        const dir = direction === 'asc' ? 1 : -1;
        sorted.sort((a, b) => {
            const va = a[field], vb = b[field];
            if (va == null)
                return 1;
            if (vb == null)
                return -1;
            if (typeof va === 'number' && typeof vb === 'number')
                return dir * (va - vb);
            return dir * String(va).localeCompare(String(vb));
        });
        return sorted;
    }, [data, sortState]);
    const displayData = useMemo(() => {
        const limit = tableSpec?.pageSize || 200;
        return sortedData.slice(0, limit);
    }, [sortedData, tableSpec?.pageSize]);
    const handleSort = useCallback((field) => {
        setSortState(prev => {
            if (prev?.field === field) {
                return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { field, direction: numericFields.has(field) ? 'desc' : 'asc' };
        });
    }, [numericFields]);
    const isRowHighlighted = useCallback((row) => {
        if (!highlightRow || highlightFields.length === 0)
            return false;
        return highlightFields.some(f => row[f] != null && highlightRow[f] != null && String(row[f]) === String(highlightRow[f]));
    }, [highlightRow, highlightFields]);
    function formatCell(value, col) {
        if (value == null)
            return '';
        if (numericFields.has(col.field) && typeof value === 'number') {
            if (Math.abs(value) >= 1e6)
                return (value / 1e6).toFixed(1) + 'M';
            if (Math.abs(value) >= 1e3)
                return (value / 1e3).toFixed(1) + 'K';
            if (Math.abs(value) < 1 && value !== 0)
                return value.toFixed(2);
            return value.toLocaleString();
        }
        return String(value);
    }
    function getAlign(col) {
        if (col.align)
            return col.align;
        return numericFields.has(col.field) ? 'right' : 'left';
    }
    const containerStyle = {
        width: width || '100%',
        height: height || '100%',
        overflow: 'auto',
        background: '#0f1117',
        borderRadius: 8,
    };
    const tableStyle = {
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 12,
        color: '#d1d5db',
    };
    return (_jsx("div", { style: containerStyle, className: className, children: _jsxs("table", { style: tableStyle, children: [_jsx("thead", { children: _jsx("tr", { children: columns.map(col => {
                            const isSorted = sortState?.field === col.field;
                            const arrow = isSorted ? (sortState.direction === 'asc' ? ' \u25B2' : ' \u25BC') : '';
                            return (_jsx("th", { onClick: () => handleSort(col.field), style: {
                                    padding: '8px 12px',
                                    textAlign: getAlign(col),
                                    borderBottom: '2px solid #2d3041',
                                    color: '#9ca3af',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    position: 'sticky',
                                    top: 0,
                                    background: '#0f1117',
                                    whiteSpace: 'nowrap',
                                }, children: (col.title || col.field) + arrow }, col.field));
                        }) }) }), _jsx("tbody", { children: displayData.map((row, i) => (_jsx("tr", { onMouseEnter: () => onHighlight?.(row), onMouseLeave: () => onClearHighlight?.(), style: {
                            background: isRowHighlighted(row) ? '#1a1d2e' : undefined,
                            transition: 'background 0.1s',
                        }, children: columns.map(col => (_jsx("td", { style: {
                                padding: '6px 12px',
                                textAlign: getAlign(col),
                                borderBottom: '1px solid #1f2937',
                                whiteSpace: 'nowrap',
                            }, children: formatCell(row[col.field], col) }, col.field))) }, i))) }), data.length > (tableSpec?.pageSize || 200) && (_jsx("tfoot", { children: _jsx("tr", { children: _jsxs("td", { colSpan: columns.length, style: {
                                padding: '8px 12px',
                                color: '#6b7280',
                                fontSize: 11,
                                borderTop: '1px solid #2d3041',
                            }, children: ["Showing ", displayData.length, " of ", data.length, " rows"] }) }) }))] }) }));
}
//# sourceMappingURL=DataTable.js.map