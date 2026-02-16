/**
 * Marimekko Chart — two-dimensional part-to-whole.
 *
 * Both bar width and segment height encode data:
 * width = one variable's proportion, height = another.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const marimekkoPattern: VisualizationPattern = {
  id: 'marimekko',
  name: 'Marimekko Chart',
  category: 'composition',
  description:
    'Two-dimensional stacked bar where both bar width and segment height encode data. Width represents one category\'s proportion of the total, height represents another category\'s proportion within each bar. Also known as a mosaic or mekko chart.',
  bestFor:
    'Market share by segment AND region, revenue by product AND channel, population by age AND country. Two-dimensional part-to-whole where both dimensions matter.',
  notFor:
    'Single dimension (use stacked-bar or waffle instead). More than 6 categories on either axis. Precise value comparison where small differences matter.',

  dataRequirements: {
    minRows: 4,
    maxRows: 200,
    requiredColumns: [
      { type: 'categorical', count: 2, description: 'Primary category (bar width) and secondary category (segment height)' },
      { type: 'numeric', count: 1, description: 'Value at each intersection (determines both width and height proportions)' },
    ],
    minCategories: 2,
    maxCategories: 12,
  },

  selectionRules: [
    {
      condition: 'Intent explicitly mentions marimekko, mosaic, or mekko chart',
      weight: 90,
      matches: (ctx) => {
        return /\b(marimekko|mosaic\s*chart|mekko|mari[\s-]?mekko)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Two-dimensional part-to-whole intent with 2 categorical + 1 numeric',
      weight: 60,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          /\b(two[\s-]?dimensional|2[\s-]?d|proportional\s+width|variable[\s-]?width)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Part-to-whole with two categories and moderate data',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.categoryCount >= 2 &&
          ctx.dataShape.categoryCount <= 6 &&
          ctx.dataShape.seriesCount >= 2 &&
          ctx.dataShape.seriesCount <= 6 &&
          /\b(share|proportion|percent|part.of|makeup|composition|breakdown)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Intent mentions both dimensions of composition (e.g. "by X and Y")',
      weight: 35,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          /\b(by\s+\w+\s+and\s+\w+|across\s+both|two\s+dimensions)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Penalize for single categorical dimension — use stacked-bar or waffle',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount < 2;
      },
    },
    {
      condition: 'Penalize for too many primary categories — bars become too thin',
      weight: -35,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 6;
      },
    },
    {
      condition: 'Penalize for too many secondary categories — segments become too small',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.seriesCount > 6;
      },
    },
    {
      condition: 'Penalize for time series data — line or area is better',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const primaryCol = columns[0];
    const secondaryCol = columns.length > 1 ? columns[1] : columns[0];
    const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'marimekko',
      title: options?.title ?? `${valueCol} by ${primaryCol} and ${secondaryCol}`,
      data,
      encoding: {
        x: {
          field: primaryCol,
          type: 'nominal',
          title: primaryCol,
        },
        color: {
          field: secondaryCol,
          type: 'nominal',
          title: secondaryCol,
        },
      },
      config: {
        categoryField: primaryCol,
        seriesField: secondaryCol,
        valueField: valueCol,
        sortBy: options?.sortBy ?? 'value',
        sortOrder: options?.sortOrder ?? 'descending',
        showLabels: options?.showLabels ?? true,
        showPercentages: options?.showPercentages ?? true,
      },
    };

    return spec;
  },
};
