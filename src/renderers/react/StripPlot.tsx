/**
 * React component for the Strip Plot pattern.
 * Thin wrapper around the D3 renderStripPlot function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderStripPlot } from '../d3/distribution/strip-plot.js';

export function StripPlot({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderStripPlot, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
