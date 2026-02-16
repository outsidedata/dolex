/**
 * React component for the Circle Pack pattern.
 * Thin wrapper around the D3 renderCirclePack function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderCirclePack } from '../d3/composition/circle-pack.js';

export function CirclePack({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderCirclePack, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
