/**
 * Standard Bar Chart — the baseline comparison pattern.
 *
 * This is the "default" that every other comparison pattern
 * must beat. It works well for most categorical comparisons
 * but is rarely the BEST choice.
 */

import type { VisualizationPattern, VisualizationSpec, DataColumn } from '../../../types.js';

export const barPattern: VisualizationPattern = {
  id: 'bar',
  name: 'Bar Chart',
  category: 'comparison',
  description:
    'Standard vertical bar chart for comparing values across categories. The reliable default for categorical comparison.',
  bestFor: 'Simple categorical comparison with 3-15 categories and one value metric.',
  notFor:
    'Time series (use line), part-to-whole (use waffle/stacked), distribution (use histogram/beeswarm), rank changes (use bump chart).',

  dataRequirements: {
    minRows: 2,
    maxRows: 50,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Category axis' },
      { type: 'numeric', count: 1, description: 'Value to compare' },
    ],
    minCategories: 2,
    maxCategories: 25,
  },

  selectionRules: [
    {
      condition: 'Default comparison: categories with one numeric value',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          !ctx.dataShape.hasTimeSeries
        );
      },
    },
    {
      condition: 'Moderate category count (3-15)',
      weight: 15,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount >= 3 && ctx.dataShape.categoryCount <= 15;
      },
    },
    {
      condition: 'Intent includes comparison keywords',
      weight: 10,
      matches: (ctx) => {
        return /\b(compar|rank|top|bottom|highest|lowest|most|least|largest|smallest)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Penalize when better alternatives exist: two-point comparison',
      weight: -20,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount === 2 && ctx.dataShape.categoryCount >= 3;
      },
    },
    {
      condition: 'Penalize for time series data',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const xCol = columns[0];
    const yCol = columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'bar',
      title: options?.title ?? `${yCol} by ${xCol}`,
      data,
      encoding: {
        x: {
          field: xCol,
          type: 'nominal',
          title: xCol,
          sort: 'descending',
        },
        y: {
          field: yCol,
          type: 'quantitative',
          title: yCol,
        },
        color: {
          field: xCol,
          type: 'nominal',
          scale: {},
        },
      },
      config: {
        orientation: options?.horizontal ? 'horizontal' : 'vertical',
        sortBy: options?.sortBy ?? 'value',
        sortOrder: options?.sortOrder ?? 'descending',
        showLabels: options?.showLabels ?? (data.length <= 12),
      },
    };

    return spec;
  },
};
