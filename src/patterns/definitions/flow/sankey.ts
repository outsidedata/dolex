/**
 * Sankey Diagram — flow between states.
 *
 * Shows quantities flowing from sources to destinations through
 * intermediate nodes. Width of each flow encodes magnitude.
 * Ideal for energy flows, budget allocation, user conversion funnels.
 */

import type { VisualizationPattern, VisualizationSpec } from '../../../types.js';

export const sankeyPattern: VisualizationPattern = {
  id: 'sankey',
  name: 'Sankey Diagram',
  category: 'flow',
  description:
    'Nodes connected by flows whose width represents quantity. Shows how a total distributes through a system: sources, intermediate steps, and destinations.',
  bestFor:
    'Energy flow, budget allocation, user journey funnels, import/export trade, material flow, conversion pipelines.',
  notFor:
    'Simple composition (use stacked bar or waffle), non-flow data, cyclical flows (Sankey requires directed acyclic graph).',

  dataRequirements: {
    minRows: 3,
    maxRows: 200,
    requiredColumns: [
      { type: 'categorical', count: 2, description: 'Source and target nodes' },
      { type: 'numeric', count: 1, description: 'Flow quantity' },
    ],
  },

  selectionRules: [
    {
      condition: 'Source-target-value structure — Sankey is the natural choice',
      weight: 85,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1 &&
          /\b(from|source|origin)\b/i.test(
            ctx.columns
              .filter((c) => c.type === 'categorical')
              .map((c) => c.name)
              .join(' ')
          )
        );
      },
    },
    {
      condition: 'Intent mentions flow, Sankey, funnel, or path',
      weight: 70,
      matches: (ctx) => {
        return /\b(flow|sankey|funnel|path|journey|pipeline|from\s+.+\s+to|source.+target|allocation|distribut.+through)\b/i.test(
          ctx.intent
        );
      },
    },
    {
      condition: 'Two categorical columns suggesting from/to relationship',
      weight: 40,
      matches: (ctx) => {
        return (
          ctx.dataShape.categoricalColumnCount >= 2 &&
          ctx.dataShape.numericColumnCount >= 1
        );
      },
    },
    {
      condition: 'Penalize for single categorical column — no from/to relationship',
      weight: -40,
      matches: (ctx) => {
        return ctx.dataShape.categoricalColumnCount < 2;
      },
    },
    {
      condition: 'Penalize for time series — alluvial is better for temporal flows',
      weight: -20,
      matches: (ctx) => {
        return ctx.dataShape.hasTimeSeries;
      },
    },
  ],

  generateSpec: (data, columns, options) => {
    const sourceCol = columns[0];
    const targetCol = columns.length > 1 ? columns[1] : columns[0];
    const valueCol = columns.length > 2 ? columns[2] : columns.length > 1 ? columns[1] : columns[0];

    // Extract unique nodes
    const nodes = [
      ...new Set([
        ...data.map((d) => d[sourceCol]),
        ...data.map((d) => d[targetCol]),
      ]),
    ].map((name) => ({ name: String(name) }));

    // Build links
    const links = data.map((d) => ({
      source: String(d[sourceCol]),
      target: String(d[targetCol]),
      value: Number(d[valueCol]) || 0,
    }));

    const spec: VisualizationSpec = {
      pattern: 'sankey',
      title: options?.title ?? `Flow from ${sourceCol} to ${targetCol}`,
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
          range: [1, 50] as [number, number],
        },
      },
      config: {
        sourceField: sourceCol,
        targetField: targetCol,
        valueField: valueCol,
        nodes,
        links,
        nodeWidth: options?.nodeWidth ?? 20,
        nodePadding: options?.nodePadding ?? 10,
        nodeAlign: options?.nodeAlign ?? 'justify',
        linkOpacity: options?.linkOpacity ?? 0.5,
        showLabels: options?.showLabels ?? true,
        showValues: options?.showValues ?? true,
      },
    };

    return spec;
  },
};
