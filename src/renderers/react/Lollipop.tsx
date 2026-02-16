import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderLollipop } from '../d3/comparison/lollipop.js';

export function Lollipop({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderLollipop, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
