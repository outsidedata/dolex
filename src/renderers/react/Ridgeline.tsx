/**
 * React component for the Ridgeline pattern.
 * Thin wrapper around the D3 renderRidgeline function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderRidgeline } from '../d3/distribution/ridgeline.js';

export function Ridgeline({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderRidgeline, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
