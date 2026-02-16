/**
 * React component for the Stacked Bar pattern.
 * Thin wrapper around the D3 renderStackedBar function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderStackedBar } from '../d3/composition/stacked-bar.js';

export function StackedBar({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderStackedBar, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
