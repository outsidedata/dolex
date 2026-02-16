import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderBullet } from '../d3/comparison/bullet.js';

export function Bullet({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderBullet, width, height, onReady);
  return <div ref={containerRef} className={className} />;
}
