/**
 * React component for the Parallel Coordinates pattern.
 * Thin wrapper around the D3 renderParallelCoordinates function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderParallelCoordinates } from '../d3/parallel-coordinates.js';

export function ParallelCoordinates({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderParallelCoordinates, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
