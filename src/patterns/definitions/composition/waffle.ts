/**
 * Waffle Chart — part-to-whole, better than pie.
 *
 * A grid of small squares where each square represents a unit
 * (usually 1%). More accurate than pie charts because humans
 * are better at counting squares than estimating angles.
 * The go-to replacement for pie charts.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const wafflePattern: VisualizationPattern = {
  id: 'waffle',
  name: 'Waffle Chart',
  category: 'composition',
  description:
    'A 10x10 grid of colored squares, each representing 1% of the total. More perceptually accurate than pie charts for showing proportions.',
  bestFor:
    'Part-to-whole comparisons with 2-8 categories. Percentage breakdowns. Survey results. Market share. Election results.',
  notFor:
    'Many categories over 8 (too many colors). Very small differences (hard to see 1% vs 2%). Non-percentage data (requires total context).',

  dataRequirements: {
    minRows: 2,
    maxRows: 8,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Category labels' },
      { type: 'numeric', count: 1, description: 'Value (will be converted to proportions)' },
    ],
    minCategories: 2,
    maxCategories: 8,
  },

  selectionRules: [
    {
      condition: 'Part-to-whole with few categories — waffle beats pie every time',
      weight: 75,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoryCount >= 2 &&
          ctx.dataShape.categoryCount <= 8 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Intent mentions percentage, proportion, or share',
      weight: 60,
      matches: (ctx) => {
        return /\b(percent|proportion|share|part.of|makeup|pie|waffle|how\s+much\s+of)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Very few categories (2-4) — waffle is clearest',
      weight: 30,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount >= 2 && ctx.dataShape.categoryCount <= 4;
      },
    },
    {
      condition: 'Penalize for too many categories — colors become indistinguishable',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount > 8;
      },
    },
    {
      condition: 'Penalize when data has time dimension — composition over time is better as stacked',
      weight: -20,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
    {
      condition: 'Penalize for hierarchical data — treemap is better',
      weight: -25,
      matches: (ctx) => {
        return ctx.dataShape.hasHierarchy;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const valueCol = columns.length > 1 ? columns[1] : columns[0];

    // Calculate percentages
    const total = data.reduce((sum, row) => sum + (Number(row[valueCol]) || 0), 0);
    const waffleData = data.map((row) => ({
      ...row,
      _percentage: total > 0 ? ((Number(row[valueCol]) || 0) / total) * 100 : 0,
      _squares: total > 0 ? Math.round(((Number(row[valueCol]) || 0) / total) * 100) : 0,
    }));

    // Ensure squares sum to 100 by adjusting the largest category
    const totalSquares = waffleData.reduce((sum, row) => sum + row._squares, 0);
    if (totalSquares !== 100 && waffleData.length > 0) {
      const sorted = [...waffleData].sort((a, b) => b._percentage - a._percentage);
      sorted[0]._squares += 100 - totalSquares;
    }

    const spec: VisualizationSpec = {
      pattern: 'waffle',
      title: options?.title ?? `${valueCol} composition`,
      data: waffleData,
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
        gridSize: options?.gridSize ?? 10,
        squareSize: options?.squareSize ?? 20,
        gap: options?.gap ?? 2,
        total,
      },
    };

    return spec;
  },
};
