import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderHeatmap } from '../d3/heatmap.js';

export function Heatmap({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderHeatmap, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
