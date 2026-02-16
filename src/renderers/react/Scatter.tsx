/**
 * React component for the Scatter Plot pattern.
 * Thin wrapper around the D3 renderScatter function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderScatter } from '../d3/relationship.js';

export function Scatter({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderScatter, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
