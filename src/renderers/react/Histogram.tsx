/**
 * React component for the Histogram pattern.
 * Thin wrapper around the D3 renderHistogram function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderHistogram } from '../d3/distribution/histogram.js';

export function Histogram({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderHistogram, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
