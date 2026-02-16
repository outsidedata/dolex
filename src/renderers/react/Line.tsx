/**
 * React component for the Line Chart pattern.
 * Thin wrapper around the D3 renderLine function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderLine } from '../d3/time/line.js';

export function Line({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderLine, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
