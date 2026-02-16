/**
 * React component for the Radar Chart pattern.
 * Thin wrapper around the D3 renderRadar function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderRadar } from '../d3/radar.js';

export function Radar({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderRadar, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
