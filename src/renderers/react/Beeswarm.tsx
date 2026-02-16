/**
 * React component for the Beeswarm pattern.
 * Thin wrapper around the D3 renderBeeswarm function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderBeeswarm } from '../d3/distribution/beeswarm.js';

export function Beeswarm({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderBeeswarm, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
