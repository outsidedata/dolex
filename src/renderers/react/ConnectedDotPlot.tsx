/**
 * React component for the Connected Dot Plot pattern.
 * Thin wrapper around the D3 renderConnectedDotPlot function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderConnectedDotPlot } from '../d3/comparison/connected-dot-plot.js';

export function ConnectedDotPlot({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderConnectedDotPlot, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
