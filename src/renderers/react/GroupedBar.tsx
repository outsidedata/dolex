import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderGroupedBar } from '../d3/comparison/grouped-bar.js';

export function GroupedBar({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderGroupedBar, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
