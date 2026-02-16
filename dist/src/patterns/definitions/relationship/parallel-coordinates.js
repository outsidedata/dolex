/**
 * Parallel Coordinates — multivariate comparison.
 *
 * Each axis represents a variable. Each entity is a polyline
 * connecting its values across all axes. Reveals which variables
 * cluster together and how entities differ across many dimensions.
 */
export const parallelCoordinatesPattern = {
    id: 'parallel-coordinates',
    name: 'Parallel Coordinates',
    category: 'relationship',
    description: 'Multiple parallel vertical axes, one per variable. Each entity is a polyline crossing all axes at its values. Reveals multivariate patterns, clusters, and tradeoffs.',
    bestFor: 'Comparing entities across 4+ numeric dimensions: car specs (mpg, hp, weight, price), player stats, product features, survey multi-question analysis.',
    notFor: 'Few variables under 3 (use scatter or bar), very many rows over 200 (lines overlap — filter first), non-numeric data.',
    dataRequirements: {
        minRows: 5,
        maxRows: 200,
        requiredColumns: [
            { type: 'numeric', count: 3, description: 'Three or more numeric dimensions' },
        ],
    },
    selectionRules: [
        {
            condition: 'Many numeric dimensions (4+) — parallel coordinates shows all at once',
            weight: 80,
            matches: (ctx) => {
                return ctx.dataShape.numericColumnCount >= 4 && ctx.dataShape.rowCount <= 200;
            },
        },
        {
            condition: 'Intent mentions multivariate, dimensions, or profile comparison',
            weight: 60,
            matches: (ctx) => {
                return /\b(multivariat|multi.dimension|across\s+all|all\s+(metrics|variables|dimensions)|profile|parallel|specs|specifications)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Three numeric columns with categorical grouping — parallel coordinates with color',
            weight: 50,
            matches: (ctx) => {
                return (ctx.dataShape.numericColumnCount >= 3 &&
                    ctx.dataShape.categoricalColumnCount >= 1 &&
                    ctx.dataShape.categoryCount <= 8);
            },
        },
        {
            condition: 'Penalize for few numeric columns — scatter or bar is simpler',
            weight: -40,
            matches: (ctx) => {
                return ctx.dataShape.numericColumnCount < 3;
            },
        },
        {
            condition: 'Penalize for too many rows — lines become indistinguishable',
            weight: -30,
            matches: (ctx) => {
                return ctx.dataShape.rowCount > 200;
            },
        },
    ],
    generateSpec: (data, columns, options) => {
        // Separate numeric dimensions from categorical grouping column
        const numericCols = [];
        let groupCol = options?.groupField;
        for (const col of columns) {
            const sample = data.find(d => d[col] != null)?.[col];
            if (typeof sample === 'number' || !isNaN(Number(sample))) {
                numericCols.push(col);
            }
            else if (!groupCol) {
                groupCol = col;
            }
        }
        const spec = {
            pattern: 'parallel-coordinates',
            title: options?.title ?? `Multivariate comparison across ${numericCols.length} dimensions`,
            data,
            encoding: {
                axes: numericCols.map((col) => ({
                    field: col,
                    type: 'quantitative',
                    title: col,
                })),
                color: groupCol
                    ? {
                        field: groupCol,
                        type: 'nominal',
                        title: groupCol,
                    }
                    : undefined,
            },
            config: {
                dimensions: numericCols,
                colorField: groupCol ?? null,
                labelField: options?.labelField ?? numericCols[0],
                showAxisLabels: options?.showAxisLabels ?? true,
                lineOpacity: options?.lineOpacity ?? 0.4,
                strokeWidth: options?.strokeWidth ?? 1.5,
            },
        };
        return spec;
    },
};
//# sourceMappingURL=parallel-coordinates.js.map