import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderBoxPlot } from '../d3/distribution/box-plot.js';

export function BoxPlot({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderBoxPlot, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
