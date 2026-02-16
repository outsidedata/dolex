/**
 * Donut Chart — circular part-to-whole with hollow center.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const donutPattern: VisualizationPattern = {
  id: 'donut',
  name: 'Donut Chart',
  category: 'composition',
  description:
    'Circular part-to-whole chart with a hollow center showing category proportions as arc segments. The classic pie/donut.',
  bestFor:
    'Simple part-to-whole with 2-6 categories. Budget breakdown, market share, survey responses, vote share, portfolio allocation.',
  notFor:
    'More than 8 categories (slices become unreadable). Small differences between slices (hard to compare angles). Showing change over time. Precise value comparison.',

  dataRequirements: {
    minRows: 2,
    maxRows: 8,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Category labels (slices)' },
      { type: 'numeric', count: 1, description: 'Value per category (determines arc angle)' },
    ],
    minCategories: 2,
    maxCategories: 8,
  },

  selectionRules: [
    {
      condition: 'Intent explicitly mentions pie, donut, or circular chart',
      weight: 85,
      matches: (ctx) => {
        return /\b(pie\s*chart|donut\s*chart|pie|donut|circular)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Part-to-whole with few categories',
      weight: 55,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoryCount >= 2 &&
          ctx.dataShape.categoryCount <= 6 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Intent mentions percentage, proportion, or share',
      weight: 45,
      matches: (ctx) => {
        return /\b(percent|proportion|share|part.of|makeup|how\s+much\s+of|breakdown)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Very few categories (2-4) — donut is clean and simple',
      weight: 25,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount >= 2 && ctx.dataShape.categoryCount <= 4;
      },
    },
    {
      condition: 'Penalize for too many categories — slices become unreadable',
      weight: -50,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 8;
      },
    },
    {
      condition: 'Penalize when data has time dimension — stacked area or line is better',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
    {
      condition: 'Penalize for hierarchical data — treemap or sunburst is better',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.hasHierarchy;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const valueCol = columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'donut',
      title: options?.title ?? `${valueCol} breakdown`,
      data,
      encoding: {
        color: {
          field: categoryCol,
          type: 'nominal',
          title: categoryCol,
        },
      },
      config: {
        categoryField: categoryCol,
        valueField: valueCol,
        startAngle: options?.startAngle ?? 0,
        innerRadius: options?.innerRadius ?? 0.55,
        showLabels: options?.showLabels ?? true,
        showPercentages: options?.showPercentages ?? true,
        centerLabel: options?.centerLabel ?? '',
      },
    };

    return spec;
  },
};
