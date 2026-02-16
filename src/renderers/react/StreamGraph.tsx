import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderStreamGraph } from '../d3/time/stream-graph.js';

export function StreamGraph({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderStreamGraph, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
