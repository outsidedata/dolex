/**
 * React component for the Diverging Bar pattern.
 * Thin wrapper around the D3 renderDivergingBar function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderDivergingBar } from '../d3/comparison/diverging-bar.js';

export function DivergingBar({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderDivergingBar, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
