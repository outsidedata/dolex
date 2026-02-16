/**
 * React component for the Donut pattern.
 * Thin wrapper around the D3 renderDonut function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderDonut } from '../d3/composition/donut.js';

export function Donut({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderDonut, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
