/**
 * React component for the Area Chart pattern.
 * Thin wrapper around the D3 renderArea function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderArea } from '../d3/time/area.js';

export function Area({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderArea, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
