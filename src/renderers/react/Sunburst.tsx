/**
 * React component for the Sunburst pattern.
 * Thin wrapper around the D3 renderSunburst function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderSunburst } from '../d3/composition/sunburst.js';

export function Sunburst({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderSunburst, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
