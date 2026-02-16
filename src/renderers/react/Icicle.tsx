import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderIcicle } from '../d3/composition/icicle.js';

export function Icicle({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderIcicle, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
