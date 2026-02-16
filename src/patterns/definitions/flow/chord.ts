/**
 * Chord Diagram — relationships between groups.
 *
 * A circular layout where arcs represent groups and chords
 * represent flows between them. The width of each chord
 * encodes the magnitude of the relationship. Shows
 * bidirectional flows and relative importance.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const chordPattern: VisualizationPattern = {
  id: 'chord',
  name: 'Chord Diagram',
  category: 'flow',
  description:
    'Circular layout with arcs for groups and curved chords connecting them. Chord width represents flow magnitude. Shows mutual relationships and overall connectivity.',
  bestFor:
    'Bidirectional flows between groups: trade between countries, migration between regions, collaboration between departments, phone calls between cities.',
  notFor:
    'Unidirectional flow (use Sankey), many groups over 12 (too dense), non-relational data.',

  dataRequirements: {
    minRows: 3,
    maxRows: 100,
    requiredColumns: [
      { type: 'categorical', count: 2, description: 'Source and target groups (often the same set)' },
      { type: 'numeric', count: 1, description: 'Flow/relationship magnitude' },
    ],
    minCategories: 3,
    maxCategories: 12,
  },

  selectionRules: [
    {
      condition: 'Bidirectional relationships between groups — chord shows mutual flows',
      weight: 80,
      matches: (ctx) => {
        if (ctx.dataShape.categoricalColumnCount < 2 || ctx.dataShape.numericColumnCount < 1) return false;
        // Check if source and target draw from the same set of values
        const cats = ctx.columns.filter((c) => c.type === 'categorical');
        if (cats.length < 2) return false;
        const sourceVals = new Set(ctx.data.map((d) => d[cats[0].name]));
        const targetVals = new Set(ctx.data.map((d) => d[cats[1].name]));
        let overlap = 0;
        for (const v of sourceVals) {
          if (targetVals.has(v)) overlap++;
        }
        // If significant overlap, it's likely bidirectional group-to-group data
        return overlap >= Math.min(sourceVals.size, targetVals.size) * 0.5;
      },
    },
    {
      condition: 'Intent mentions chord, mutual, bidirectional, or between groups',
      weight: 60,
      matches: (ctx) => {
        return /\b(chord|mutual|bidirectional|between\s+groups|inter.*(department|region|country)|trade\s+between|migration\s+between|collaborat)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Moderate number of groups (3-12) — sweet spot for chord',
      weight: 30,
      matches: (ctx) => {
        const allCategories = new Set([
          ...ctx.data.map((d) => {
            const cats = ctx.columns.filter((c) => c.type === 'categorical');
            return cats.length > 0 ? d[cats[0].name] : null;
          }),
          ...ctx.data.map((d) => {
            const cats = ctx.columns.filter((c) => c.type === 'categorical');
            return cats.length > 1 ? d[cats[1].name] : null;
          }),
        ]);
        return allCategories.size >= 3 && allCategories.size <= 12;
      },
    },
    {
      condition: 'Penalize for clearly unidirectional flow — use Sankey instead',
      weight: -20,
      matches: (ctx) => {
        return /\b(funnel|pipeline|step|stage|conversion)\b/i.test(ctx.intent);
      },
    },
    {
      condition: 'Penalize for single categorical column — no group-to-group relationship',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount < 2;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const sourceCol = columns[0];
    const targetCol = columns.length > 1 ? columns[1] : columns[0];
    const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];

    const spec: VisualizationSpec = {
      pattern: 'chord',
      title: options?.title ?? `Relationships between ${sourceCol} groups`,
      data,
      encoding: {
        source: {
          field: sourceCol,
          type: 'nominal',
        },
        target: {
          field: targetCol,
          type: 'nominal',
        },
        size: {
          field: valueCol,
          type: 'quantitative' as const,
          title: valueCol,
          range: [1, 30] as [number, number],
        },
      },
      config: {
        sourceField: sourceCol,
        targetField: targetCol,
        valueField: valueCol,
        padAngle: options?.padAngle ?? 0.05,
        ribbonOpacity: options?.ribbonOpacity ?? 0.5,
        showLabels: options?.showLabels ?? true,
      },
    };

    return spec;
  },
};
