/**
 * React component for the Alluvial Chart pattern.
 * Thin wrapper around the D3 renderAlluvial function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderAlluvial } from '../d3/flow/alluvial.js';

export function Alluvial({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderAlluvial, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
