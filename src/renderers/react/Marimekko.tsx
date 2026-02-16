/**
 * React component for the Marimekko pattern.
 * Thin wrapper around the D3 renderMarimekko function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderMarimekko } from '../d3/composition/marimekko.js';

export function Marimekko({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderMarimekko, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
