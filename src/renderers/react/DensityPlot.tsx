import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderDensityPlot } from '../d3/distribution/density-plot.js';

export function DensityPlot({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderDensityPlot, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
