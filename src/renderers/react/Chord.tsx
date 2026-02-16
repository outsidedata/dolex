/**
 * React component for the Chord Chart pattern.
 * Thin wrapper around the D3 renderChord function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderChord } from '../d3/flow/chord.js';

export function Chord({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderChord, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
