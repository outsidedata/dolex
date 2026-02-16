import { applyGeoScope, buildGeoSpecConfig } from '../../../renderers/d3/geo/geo-scope.js';
export const choroplethPattern = {
    id: 'choropleth',
    name: 'Choropleth Map',
    category: 'geo',
    description: 'Geographic regions shaded by data values. Darker colors indicate higher values, instantly revealing spatial patterns.',
    bestFor: 'Country-level data: GDP, population, election results, disease rates, temperature. Any numeric metric with a geographic key.',
    notFor: 'Point data (use proportional symbol), routes/trajectories, non-geographic categories, data with no geographic key.',
    dataRequirements: {
        minRows: 3,
        maxRows: 300,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Geographic identifier (country name, ISO code, state)' },
            { type: 'numeric', count: 1, description: 'Value to color-encode' },
        ],
        minCategories: 3,
    },
    selectionRules: [
        {
            condition: 'Intent explicitly mentions map or geographic visualization',
            weight: 85,
            matches: (ctx) => {
                return /\b(map|geographic|choropleth|country|countries|state\s+map|province|spatial|world\s+map|heat\s*map.*countr)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Data has a column that looks like country/state names or codes',
            weight: 50,
            matches: (ctx) => {
                const catCols = ctx.columns.filter((c) => c.type === 'categorical');
                return catCols.some((col) => {
                    const samples = col.sampleValues.map((v) => v.toLowerCase());
                    const geoIndicators = ['usa', 'china', 'india', 'uk', 'france', 'germany', 'brazil', 'japan', 'california', 'texas', 'new york'];
                    return samples.some((s) => geoIndicators.some((g) => s.includes(g)));
                });
            },
        },
        {
            condition: 'Penalize when no numeric column for coloring',
            weight: -40,
            matches: (ctx) => ctx.dataShape.numericColumnCount === 0,
        },
    ],
    generateSpec: (data, columns, options) => {
        const geoCol = columns[0];
        const valueCol = columns.length > 1 ? columns[1] : columns[0];
        const geo = applyGeoScope(data, geoCol, options);
        const regionLabel = geo.regionConfig?.subdivisionType ?? (geo.isUs ? 'State' : 'Region');
        return {
            pattern: 'choropleth',
            title: options?.title ?? `${valueCol} by ${regionLabel}`,
            data: geo.data,
            encoding: {
                geo: { field: geoCol, type: 'nominal' },
                color: {
                    field: valueCol,
                    type: 'quantitative',
                    scale: options?.colorScale,
                },
            },
            config: {
                geoField: geoCol,
                valueField: valueCol,
                mapType: geo.mapType,
                projection: geo.projection,
                colorScheme: options?.colorScheme ?? 'blues',
                ...buildGeoSpecConfig(geo),
            },
        };
    },
};
//# sourceMappingURL=choropleth.js.map