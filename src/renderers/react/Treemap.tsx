/**
 * React component for the Treemap pattern.
 * Thin wrapper around the D3 renderTreemap function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderTreemap } from '../d3/composition/treemap.js';

export function Treemap({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderTreemap, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
