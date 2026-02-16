/**
 * Icicle Chart — linear (rectangular) alternative to sunburst for hierarchies.
 *
 * Nested rectangles arranged vertically or horizontally, showing hierarchy
 * depth with position and size with width/height. Excels when you need
 * readable labels at every level.
 */
export const iciclePattern = {
    id: 'icicle',
    name: 'Icicle Chart',
    category: 'composition',
    description: 'Linear (rectangular) hierarchy chart where depth maps to position along one axis and size maps to extent along the other. Like a sunburst unrolled into rectangles.',
    bestFor: 'Same as sunburst/treemap but when you need readable labels at every level. File system browsers, org hierarchies, taxonomy breakdowns.',
    notFor: 'Flat data, precise value comparison, non-hierarchical data.',
    dataRequirements: {
        minRows: 4,
        maxRows: 500,
        requiredColumns: [
            { type: 'categorical', count: 2, description: 'Hierarchy levels (2+ categorical columns)' },
            { type: 'numeric', count: 1, description: 'Size value for rectangle extent' },
        ],
        requiresHierarchy: true,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions icicle chart',
            weight: 90,
            matches: (ctx) => {
                return /\b(icicle\s*chart|icicle)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Hierarchical data where labels matter — icicle keeps them readable',
            weight: 65,
            matches: (ctx) => {
                return (ctx.dataShape.hasHierarchy &&
                    ctx.dataShape.categoricalColumnCount >= 2 &&
                    ctx.dataShape.numericColumnCount >= 1 &&
                    /\b(label|read|name|text|browse|explore)\b/i.test(ctx.intent));
            },
        },
        {
            condition: 'Deep hierarchy (3+ levels) with browsing/exploration intent',
            weight: 55,
            matches: (ctx) => {
                return (ctx.dataShape.hasHierarchy &&
                    ctx.dataShape.categoricalColumnCount >= 3 &&
                    ctx.dataShape.numericColumnCount >= 1);
            },
        },
        {
            condition: 'Intent mentions hierarchy with linear or rectangular layout',
            weight: 50,
            matches: (ctx) => {
                return /\b(hierarch|nested|partition|file\s*system|org\s*chart|taxonomy)\b/i.test(ctx.intent) &&
                    /\b(linear|rect|rectangular|horizontal|vertical)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Two-level hierarchy with many items',
            weight: 35,
            matches: (ctx) => {
                return (ctx.dataShape.hasHierarchy &&
                    ctx.dataShape.categoricalColumnCount >= 2 &&
                    ctx.dataShape.categoryCount >= 5);
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
            condition: 'Penalize for non-hierarchical data with single categorical column',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.categoricalColumnCount < 2;
            },
        },
        {
            condition: 'Penalize for too few rows — not enough data for hierarchy',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.rowCount < 4;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        const levels = columns.slice(0, -1);
        const valueCol = columns[columns.length - 1];
        const spec = {
            pattern: 'icicle',
            title: options?.title ?? `Hierarchy: ${levels.join(' \u203A ')}`,
            data,
            encoding: {
                color: {
                    field: levels[0],
                    type: 'nominal',
                    title: levels[0],
                },
            },
            config: {
                levelFields: levels,
                valueField: valueCol,
                orientation: options?.orientation ?? 'horizontal',
                showValues: options?.showValues ?? true,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=icicle.js.map