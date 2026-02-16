/**
 * React component for the Calendar Heatmap pattern.
 * Thin wrapper around the D3 renderCalendarHeatmap function.
 */

import React from 'react';
import type { ChartProps } from './types.js';
import { useChart } from './useChart.js';
import { renderCalendarHeatmap } from '../d3/time/calendar-heatmap.js';

export function CalendarHeatmap({
  spec,
  width = 800,
  height = 500,
  className,
  onReady,
}: ChartProps) {
  const containerRef = useChart(spec, renderCalendarHeatmap, width, height, onReady);

  return <div ref={containerRef} className={className} />;
}
