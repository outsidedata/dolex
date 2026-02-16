/**
 * Sunburst — nested hierarchical composition.
 *
 * Concentric rings showing hierarchy from center outward.
 * Like a treemap but radial, which can better show the
 * relationship between levels. Supports interactive drill-down.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const sunburstPattern: VisualizationPattern = {
  id: 'sunburst',
  name: 'Sunburst Chart',
  category: 'composition',
  description:
    'Concentric rings where each ring represents a level of hierarchy. Inner rings are parents, outer rings are children. Arc angle encodes proportion.',
  bestFor:
    'Multi-level hierarchies (3+ levels): org charts with budget, file system usage, taxonomy breakdowns, nested categories.',
  notFor:
    'Flat data (use waffle), two levels only (treemap is simpler), precise value comparison (arc angles are hard to read).',

  dataRequirements: {
    minRows: 6,
    maxRows: 300,
    requiredColumns: [
      { type: 'categorical', count: 2, description: 'Hierarchy levels (parent, child)' },
      { type: 'numeric', count: 1, description: 'Size value for arc angle' },
    ],
    requiresHierarchy: true,
  },

  selectionRules: [
    {
      condition: 'Deep hierarchy (3+ categorical levels) — sunburst shows nesting clearly',
      weight: 80,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasHierarchy &&
          ctx.dataShape.categoricalColumnCount >= 3 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Intent mentions sunburst, nested, or multi-level hierarchy',
      weight: 60,
      matches: (ctx) => {
        return /\b(sunburst|concentric|nested|multi.level|drill\s*down|tree|taxonomy)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Two-level hierarchy with many items — sunburst is visually appealing',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.hasHierarchy &&
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.categoryCount >= 5
        );
      },
    },
    {
      condition: 'Penalize for flat data — no hierarchy to show',
      weight: -50,
      matches: (ctx) => {
        return !ctx.dataShape.hasHierarchy;
      },
    },
    {
      condition: 'Penalize for too few items — not enough to fill the rings',
      weight: -30,
      matches: (ctx) => {
        return ctx.dataShape.rowCount < 6;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    // Expect columns ordered by hierarchy depth: level0, level1, ..., value
    const levels = columns.slice(0, -1);
    const valueCol = columns[columns.length - 1];

    const spec: VisualizationSpec = {
      pattern: 'sunburst',
      title: options?.title ?? `Hierarchical composition: ${levels.join(' > ')}`,
      data,
      encoding: {
        angle: {
          field: valueCol,
          type: 'quantitative',
          title: valueCol,
        },
        color: {
          field: levels[0],
          type: 'nominal',
          title: levels[0],
        },
        label: {
          field: levels[levels.length - 1],
          type: 'nominal',
        },
      },
      config: {
        levelFields: levels,
        valueField: valueCol,
        innerRadius: options?.innerRadius ?? 40,
        showLabels: options?.showLabels ?? true,
        showValues: options?.showValues ?? false,
      },
    };

    return spec;
  },
};
