/**
 * Treemap — hierarchical composition.
 *
 * Nested rectangles where area encodes value. Excels at showing
 * hierarchical part-to-whole relationships: how a total breaks
 * down into groups, which break down into subgroups.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const treemapPattern: VisualizationPattern = {
  id: 'treemap',
  name: 'Treemap',
  category: 'composition',
  description:
    'Nested rectangles where area represents value. Shows hierarchical composition: total → groups → subgroups. Space-efficient for many items.',
  bestFor:
    'Hierarchical data with size values: file system usage, organizational budgets, market cap by sector and company, product category revenue.',
  notFor:
    'Non-hierarchical flat data (use waffle), comparing exact values (hard to compare rectangle areas), time series.',

  dataRequirements: {
    minRows: 4,
    maxRows: 500,
    requiredColumns: [
      { type: 'categorical', count: 1, description: 'Category labels (or hierarchical groups)' },
      { type: 'numeric', count: 1, description: 'Size value for rectangle area' },
    ],
    requiresHierarchy: false, // Works with flat data too, just better with hierarchy
  },

  selectionRules: [
    {
      condition: 'Hierarchical data — treemap is the natural choice',
      weight: 80,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasHierarchy &&
          ctx.dataShape.numericColumnCount >= 1 &&
          ctx.dataShape.categoricalColumnCount >= 2
        );
      },
    },
    {
      condition: 'Many categories (10+) with composition intent — treemap handles scale',
      weight: 55,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoryCount >= 10 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          /\b(compos|proportion|share|breakdown|makeup|size|biggest|largest)\b/i.test(ctx.intent)
        );
      },
    },
    {
      condition: 'Intent mentions treemap or hierarchical visualization',
      weight: 60,
      matches: (ctx) => {
        return /\b(treemap|hierarch|nested|drill\s*down|parent|child|sub\s*category)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Multiple categorical dimensions for nesting',
      weight: 40,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount >= 2 && ctx.dataShape.numericColumnCount >= 1;
      },
    },
    {
      condition: 'Penalize for very few categories — waffle or bar is clearer',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.categoryCount < 5 && !ctx.dataShape.hasHierarchy;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const categoryCol = columns[0];
    const valueCol = columns.length > 1 ? columns[1] : columns[0];
    const parentCol = columns.length > 2 ? columns[0] : undefined;
    const childCol = columns.length > 2 ? columns[1] : undefined;
    const sizeCol = columns.length > 2 ? columns[2] : valueCol;

    const spec: VisualizationSpec = {
      pattern: 'treemap',
      title: options?.title ?? `${valueCol} composition${parentCol ? ` (${parentCol} > ${childCol})` : ''}`,
      data,
      encoding: {
        size: {
          field: sizeCol,
          type: 'quantitative',
          title: sizeCol,
        },
        color: {
          field: parentCol ?? categoryCol,
          type: 'nominal',
          title: parentCol ?? categoryCol,
        },
        label: {
          field: childCol ?? categoryCol,
          type: 'nominal',
        },
      },
      config: {
        categoryField: categoryCol,
        valueField: sizeCol,
        parentField: parentCol ?? null,
        childField: childCol ?? null,
        showLabels: options?.showLabels ?? true,
        padding: options?.padding ?? 2,
        borderWidth: options?.borderWidth ?? 1,
      },
    };

    return spec;
  },
};
