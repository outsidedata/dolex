/**
 * Density Plot — smooth continuous distribution curve.
 *
 * Uses kernel density estimation (KDE) to show the probability density
 * of continuous values. Like a smooth histogram without binning artifacts.
 * Supports 2-4 overlapping group distributions for comparison.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const densityPlotPattern: VisualizationPattern = {
  id: 'density-plot',
  name: 'Density Plot',
  category: 'distribution',
  description:
    'Smooth continuous curve showing probability density using kernel density estimation (KDE). Reveals distribution shape without binning artifacts.',
  bestFor:
    'Visualizing the shape of a continuous distribution. Comparing 2-4 overlapping distributions. Finding multimodal patterns, skewness, and tails.',
  notFor:
    'Small samples under 20 data points. Discrete or categorical data. More than 5 overlapping distributions (too much overplotting).',

  dataRequirements: {
    minRows: 20,
    requiredColumns: [
      { type: 'numeric', count: 1, description: 'Continuous value to estimate density for' },
    ],
    maxCategories: 5,
  },

  selectionRules: [
    {
      condition: 'Intent explicitly mentions density, KDE, or kernel density',
      weight: 80,
      matches: (ctx) => {
        return /\b(density\s*plot|density\s*curve|kde|kernel\s*density|probability\s*density)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Continuous numeric data with enough rows for smooth KDE estimation',
      weight: 45,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.rowCount >= 20 &&
          ctx.dataShape.categoricalColumnCount <= 1
        );
      },
    },
    {
      condition: 'Intent mentions smooth distribution or distribution shape comparison',
      weight: 55,
      matches: (ctx) => {
        return /\b(smooth\s*distribution|distribution\s*shape|distribution\s*comparison|overlapping\s*distribution|compare\s*distributions)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Few groups (2-4) with continuous values — ideal for overlaid density curves',
      weight: 35,
      matches: (ctx) => {
        return (
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.categoricalColumnCount >= 1 &&
          ctx.dataShape.categoryCount >= 2 &&
          ctx.dataShape.categoryCount <= 4 &&
          ctx.dataShape.rowCount >= 30
        );
      },
    },
    {
      condition: 'Penalize for very small samples — KDE unreliable under 20 points',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.rowCount < 20;
      },
    },
    {
      condition: 'Penalize for categorical-only data — density needs continuous values',
      weight: -50,
      matches: (ctx) => {
        return ctx.dataShape.numericColumnCount === 0;
      },
    },
    {
      condition: 'Penalize for too many groups — overlapping curves become unreadable',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 5;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const valueCol = columns[0];
    const groupCol = columns.length > 1 ? columns[1] : undefined;

    const spec: VisualizationSpec = {
      pattern: 'density-plot',
      title: options?.title ?? (groupCol ? `${valueCol} distribution by ${groupCol}` : `${valueCol} density`),
      data,
      encoding: {
        x: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        ...(groupCol
          ? {
              color: {
                field: groupCol,
                type: 'nominal',
              },
            }
          : {}),
      },
      config: {
        valueField: valueCol,
        ...(groupCol ? { categoryField: groupCol } : {}),
        bandwidth: options?.bandwidth ?? 'auto',
        showRug: options?.showRug ?? false,
        filled: options?.filled ?? true,
      },
    };

    return spec;
  },
};
