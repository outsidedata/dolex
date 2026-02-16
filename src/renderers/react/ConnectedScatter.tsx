/**
 * React component for the Connected Scatter pattern.
 * Thin wrapper around the D3 renderConnectedScatter function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderConnectedScatter } from '../d3/connected-scatter.js';

export function ConnectedScatter({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderConnectedScatter, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
