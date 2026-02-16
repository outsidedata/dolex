/**
 * React component for the Bar Chart pattern.
 * Thin wrapper around the D3 renderBar function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderBar } from '../d3/comparison/bar.js';

export function Bar({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderBar, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
