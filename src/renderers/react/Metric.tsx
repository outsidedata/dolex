/**
 * React component for the Metric pattern.
 * Thin wrapper around the D3 renderMetric function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderMetric } from '../d3/composition/metric.js';

export function Metric({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderMetric, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
