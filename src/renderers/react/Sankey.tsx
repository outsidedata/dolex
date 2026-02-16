/**
 * React component for the Sankey Diagram pattern.
 * Thin wrapper around the D3 renderSankey function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderSankey } from '../d3/flow/sankey.js';

export function Sankey({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderSankey, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
