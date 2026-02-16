import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderHorizonChart } from '../d3/time/horizon-chart.js';

export function HorizonChart({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderHorizonChart, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
