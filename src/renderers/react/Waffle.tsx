/**
 * React component for the Waffle pattern.
 * Thin wrapper around the D3 renderWaffle function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderWaffle } from '../d3/composition/waffle.js';

export function Waffle({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderWaffle, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
