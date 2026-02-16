import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderWaterfall } from '../d3/comparison/waterfall.js';

export function Waterfall({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderWaterfall, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
