/**
 * React component for the Sparkline Grid pattern.
 * Thin wrapper around the D3 renderSparklineGrid function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderSparklineGrid } from '../d3/time/sparkline-grid.js';

export function SparklineGrid({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderSparklineGrid, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
