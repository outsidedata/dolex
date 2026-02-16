/**
 * Connected Scatterplot — two metrics over time.
 *
 * A scatter plot where points are connected chronologically,
 * showing how the relationship between two variables evolves
 * over time. The path tells a story that neither variable
 * alone would reveal.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const connectedScatterPattern: VisualizationPattern = {
  id: 'connected-scatter',
  name: 'Connected Scatterplot',
  category: 'relationship',
  description:
    'Scatter plot with points connected in time order. Shows how the relationship between two variables evolves: loops indicate cycles, spirals indicate drift.',
  bestFor:
    'Two metrics that change together over time: unemployment vs inflation (Phillips curve), GDP vs life expectancy, revenue vs customer count.',
  notFor:
    'Static two-variable relationship (use regular scatter), single variable over time (use line), many data points (path becomes tangled).',

  dataRequirements: {
    minRows: 5,
    maxRows: 100,
    requiredColumns: [
      { type: 'date', count: 1, description: 'Time ordering' },
      { type: 'numeric', count: 2, description: 'Two metrics to plot as x and y' },
    ],
    requiresTimeSeries: true,
  },

  selectionRules: [
    {
      condition: 'Two numeric variables + time dimension — connected scatter shows temporal evolution of relationship',
      weight: 75,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasTimeSeries &&
          ctx.dataShape.numericColumnCount >= 2 &&
          ctx.dataShape.rowCount >= 5 &&
          ctx.dataShape.rowCount <= 100
        );
      },
    },
    {
      condition: 'Intent mentions two metrics over time or evolving relationship',
      weight: 60,
      matches: (ctx) => {
        return /\b(two\s+(metric|variable|measure)|evolv|over\s+time.+(vs|versus|and)|phillips|relationship.+chang|how\s+.+\s+and\s+.+\s+chang)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Penalize for too many data points — path becomes unreadable',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.rowCount > 100;
      },
    },
    {
      condition: 'Penalize for no time dimension',
      weight: -50,
      matches: (ctx) => {
        return !ctx.dataShape.hasTimeSeries;
      },
    },
    {
      condition: 'Penalize for single numeric variable',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount < 2;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const timeCol = columns[0];
    const xMetricCol = columns.length > 1 ? columns[1] : columns[0];
    const yMetricCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];

    // Sort by time
    const sortedData = [...data].sort((a, b) => {
      const aTime = new Date(a[timeCol]).getTime();
      const bTime = new Date(b[timeCol]).getTime();
      return aTime - bTime;
    });

    const spec: VisualizationSpec = {
      pattern: 'connected-scatter',
      title: options?.title ?? `${yMetricCol} vs ${xMetricCol} over ${timeCol}`,
      data: sortedData,
      encoding: {
        x: {
          field: xMetricCol,
          type: 'quantitative',
          title: xMetricCol,
        },
        y: {
          field: yMetricCol,
          type: 'quantitative',
          title: yMetricCol,
        },
        order: {
          field: timeCol,
          type: 'temporal',
        },
      },
      config: {
        xField: xMetricCol,
        yField: yMetricCol,
        orderField: timeCol,
        showLabels: options?.showLabels ?? true,
        showArrows: options?.showArrows ?? true,
        dotRadius: options?.dotRadius ?? 5,
        strokeWidth: options?.strokeWidth ?? 2,
      },
    };

    return spec;
  },
};
