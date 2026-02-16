import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderFunnel } from '../d3/flow/funnel.js';

export function Funnel({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderFunnel, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
