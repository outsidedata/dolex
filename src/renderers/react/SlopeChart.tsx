/**
 * React component for the Slope Chart pattern.
 * Thin wrapper around the D3 renderSlopeChart function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderSlopeChart } from '../d3/comparison/slope-chart.js';

export function SlopeChart({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderSlopeChart, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
