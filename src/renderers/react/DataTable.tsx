/**
 * React component for the data table view in compound visualizations.
 *
 * Sortable, hoverable table with dark theme styling.
 * Participates in interaction linking via highlight/onHighlight props.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { TableViewSpec, TableColumn } from '../../types.js';

export interface DataTableProps {
  /** The data rows to display */
  data: Record<string, any>[];
  /** Table configuration */
  tableSpec?: TableViewSpec;
  /** Container width */
  width?: number;
  /** Container height */
  height?: number;
  /** Additional CSS class */
  className?: string;
  /** Currently highlighted row (from interaction bus) */
  highlightRow?: Record<string, any> | null;
  /** Fields to match on for highlighting */
  highlightFields?: string[];
  /** Callback when user hovers a row */
  onHighlight?: (row: Record<string, any>) => void;
  /** Callback when user stops hovering */
  onClearHighlight?: () => void;
}

export function DataTable({
  data,
  tableSpec,
  width,
  height,
  className,
  highlightRow,
  highlightFields = [],
  onHighlight,
  onClearHighlight,
}: DataTableProps) {
  const [sortState, setSortState] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(
    tableSpec?.sort || null
  );

  // Auto-detect columns and numeric fields
  const { columns, numericFields } = useMemo(() => {
    let cols: TableColumn[] = tableSpec?.columns || [];
    if (cols.length === 0 && data.length > 0) {
      cols = Object.keys(data[0]).map(k => ({ field: k, title: k }));
    }
    const numFields = new Set<string>();
    if (data.length > 0) {
      cols.forEach(col => {
        const sample = data.slice(0, 10).map(d => d[col.field]);
        const numCount = sample.filter(v =>
          v != null && (typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))
        ).length;
        if (numCount > sample.length * 0.7) numFields.add(col.field);
      });
    }
    return { columns: cols, numericFields: numFields };
  }, [data, tableSpec?.columns]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...data];
    if (!sortState) return sorted;
    const { field, direction } = sortState;
    const dir = direction === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      const va = a[field], vb = b[field];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
      return dir * String(va).localeCompare(String(vb));
    });
    return sorted;
  }, [data, sortState]);

  const displayData = useMemo(() => {
    const limit = tableSpec?.pageSize || 200;
    return sortedData.slice(0, limit);
  }, [sortedData, tableSpec?.pageSize]);

  const handleSort = useCallback((field: string) => {
    setSortState(prev => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: numericFields.has(field) ? 'desc' : 'asc' };
    });
  }, [numericFields]);

  const isRowHighlighted = useCallback((row: Record<string, any>) => {
    if (!highlightRow || highlightFields.length === 0) return false;
    return highlightFields.some(f =>
      row[f] != null && highlightRow[f] != null && String(row[f]) === String(highlightRow[f])
    );
  }, [highlightRow, highlightFields]);

  function formatCell(value: any, col: TableColumn): string {
    if (value == null) return '';
    if (numericFields.has(col.field) && typeof value === 'number') {
      if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
      if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
      if (Math.abs(value) < 1 && value !== 0) return value.toFixed(2);
      return value.toLocaleString();
    }
    return String(value);
  }

  function getAlign(col: TableColumn): string {
    if (col.align) return col.align;
    return numericFields.has(col.field) ? 'right' : 'left';
  }

  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height: height || '100%',
    overflow: 'auto',
    background: '#0f1117',
    borderRadius: 8,
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 12,
    color: '#d1d5db',
  };

  return (
    <div style={containerStyle} className={className}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map(col => {
              const isSorted = sortState?.field === col.field;
              const arrow = isSorted ? (sortState!.direction === 'asc' ? ' \u25B2' : ' \u25BC') : '';
              return (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field)}
                  style={{
                    padding: '8px 12px',
                    textAlign: getAlign(col) as any,
                    borderBottom: '2px solid #2d3041',
                    color: '#9ca3af',
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    position: 'sticky',
                    top: 0,
                    background: '#0f1117',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(col.title || col.field) + arrow}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, i) => (
            <tr
              key={i}
              onMouseEnter={() => onHighlight?.(row)}
              onMouseLeave={() => onClearHighlight?.()}
              style={{
                background: isRowHighlighted(row) ? '#1a1d2e' : undefined,
                transition: 'background 0.1s',
              }}
            >
              {columns.map(col => (
                <td
                  key={col.field}
                  style={{
                    padding: '6px 12px',
                    textAlign: getAlign(col) as any,
                    borderBottom: '1px solid #1f2937',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatCell(row[col.field], col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {data.length > (tableSpec?.pageSize || 200) && (
          <tfoot>
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '8px 12px',
                  color: '#6b7280',
                  fontSize: 11,
                  borderTop: '1px solid #2d3041',
                }}
              >
                Showing {displayData.length} of {data.length} rows
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
