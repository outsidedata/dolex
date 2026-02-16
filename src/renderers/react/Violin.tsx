/**
 * React component for the Violin pattern.
 * Thin wrapper around the D3 renderViolin function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderViolin } from '../d3/distribution/violin.js';

export function Violin({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderViolin, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
