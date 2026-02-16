/**
 * Stacked Bar Chart — part-to-whole over categories.
 *
 * Shows both the total and the composition of that total.
 * Best when you care about both the parts AND the whole.
 * Supports normalized (100%) mode for pure composition comparison.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const stackedBarPattern: VisualizationPattern = {
  id: 'stacked-bar',
  name: 'Stacked Bar Chart',
  category: 'composition',
  description:
    'Bars divided into colored segments, showing both total values and their composition. Each segment represents a subcategory contribution.',
  bestFor:
    'Showing how a total breaks down into parts across categories. Revenue by product by region, population by age group by country.',
  notFor:
    'Comparing individual segment values across bars (hard to compare non-baseline segments). Use grouped bar for precise comparison of parts.',

  dataRequirements: {
    minRows: 4,
    maxRows: 200,
    requiredColumns: [
      { type: 'categorical', count: 2, description: 'Category axis and segment grouping' },
      { type: 'numeric', count: 1, description: 'Value for each segment' },
    ],
    minCategories: 2,
    maxCategories: 15,
  },

  selectionRules: [
    {
      condition: 'Two categorical dimensions + numeric value — natural for stacked bar',
      weight: 55,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.seriesCount >= 2 &&
          ctx.dataShape.seriesCount <= 8
        );
      },
    },
    {
      condition: 'Intent mentions breakdown, composition, or stacked',
      weight: 45,
      matches: (ctx) => {
        return /\b(breakdown|stacked|composed|composition|made\s+up|constitut|contribution|split\s+by)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Moderate number of series segments (2-8)',
      weight: 20,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount >= 2 && ctx.dataShape.seriesCount <= 8;
      },
    },
    {
      condition: 'Penalize for too many series — segments become unreadable',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount > 8;
      },
    },
    {
      condition: 'Penalize for single categorical dimension — use regular bar',
      weight: -20,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount < 2 && ctx.dataShape.seriesCount <= 1;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const seriesCol = columns.length > 1 ? columns[1] : columns[0];
    const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'stacked-bar',
      title: options?.title ?? `${valueCol} by ${categoryCol} and ${seriesCol}`,
      data,
      encoding: {
        x: {
          field: categoryCol,
          type: 'nominal',
          title: categoryCol,
        },
        y: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        color: {
          field: seriesCol,
          type: 'nominal',
          title: seriesCol,
        },
      },
      config: {
        categoryField: categoryCol,
        seriesField: seriesCol,
        valueField: valueCol,
        sortBy: options?.sortBy,
        sortOrder: options?.sortOrder ?? 'descending',
        normalized: options?.normalized ?? false,
        showLabels: options?.showLabels ?? (data.length <= 40),
        showTotal: options?.showTotal ?? true,
      },
    };

    return spec;
  },
};
