/**
 * React component for compound visualizations.
 *
 * Renders multiple views (chart + table) in a CSS grid layout
 * with linked interaction state.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { CompoundVisualizationSpec, VisualizationSpec, CompoundView } from '../../types.js';
import { DataTable } from './DataTable.js';

/** Dynamic import type for chart components */
type ChartComponent = React.ComponentType<{
  spec: VisualizationSpec;
  width?: number;
  height?: number;
  className?: string;
  onReady?: (container: HTMLDivElement) => void;
}>;

export interface CompoundChartProps {
  /** The compound visualization spec */
  spec: CompoundVisualizationSpec;
  /** Container width in pixels */
  width?: number;
  /** Container height in pixels */
  height?: number;
  /** Additional CSS class */
  className?: string;
  /** Map of pattern IDs to React chart components */
  chartComponents?: Record<string, ChartComponent>;
}

export function CompoundChart({
  spec,
  width = 1200,
  height = 800,
  className,
  chartComponents = {},
}: CompoundChartProps) {
  const [highlightRow, setHighlightRow] = useState<Record<string, any> | null>(null);

  const highlightFields = useMemo(() => {
    return (spec.interactions || [])
      .filter(i => i.type === 'highlight')
      .map(i => i.field);
  }, [spec.interactions]);

  const handleHighlight = useCallback((row: Record<string, any>) => {
    setHighlightRow(row);
  }, []);

  const handleClearHighlight = useCallback(() => {
    setHighlightRow(null);
  }, []);

  const layout = spec.layout || { type: 'rows' };
  const sizes = layout.sizes || spec.views.map(v => v.type === 'chart' ? 3 : 2);
  const gap = layout.gap || 12;

  const gridStyle: React.CSSProperties = {
    width,
    height,
    display: 'grid',
    gap,
    padding: gap,
    background: '#0f1117',
    borderRadius: 8,
    ...(layout.type === 'columns'
      ? { gridTemplateColumns: sizes.map(s => s + 'fr').join(' '), gridTemplateRows: '1fr' }
      : { gridTemplateRows: sizes.map(s => s + 'fr').join(' '), gridTemplateColumns: '1fr' }
    ),
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

  function renderView(view: CompoundView, index: number) {
    const dims = viewDimensions[index];

    if (view.type === 'chart' && view.chart) {
      const ChartComp = chartComponents[view.chart.pattern];
      if (ChartComp) {
        const fullSpec: VisualizationSpec = {
          ...view.chart,
          data: spec.data,
        } as VisualizationSpec;
        return (
          <div key={view.id} style={{ minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <ChartComp spec={fullSpec} width={dims.width} height={dims.height} />
          </div>
        );
      }
      // Fallback: show pattern name
      return (
        <div key={view.id} style={{
          minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#6b7280', fontSize: 14,
        }}>
          Chart: {view.chart.pattern} (component not provided)
        </div>
      );
    }

    if (view.type === 'table') {
      return (
        <DataTable
          key={view.id}
          data={spec.data}
          tableSpec={view.table}
          width={dims.width}
          height={dims.height}
          highlightRow={highlightRow}
          highlightFields={highlightFields}
          onHighlight={handleHighlight}
          onClearHighlight={handleClearHighlight}
        />
      );
    }

    return null;
  }

  return (
    <div style={gridStyle} className={className}>
      {spec.views.map((view, i) => renderView(view, i))}
    </div>
  );
}
