/**
 * React component for the Small Multiples pattern.
 * Thin wrapper around the D3 renderSmallMultiples function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderSmallMultiples } from '../d3/time/small-multiples.js';

export function SmallMultiples({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderSmallMultiples, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
