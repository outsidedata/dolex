/**
 * Proportional Symbol Map — sized circles on a geographic base.
 *
 * Places circles at geographic locations, sized by a data value.
 * Better than choropleth for point data (cities, facilities) and
 * when you need to show magnitude without area-distortion bias.
 */
import { applyGeoScope, buildGeoSpecConfig } from '../../../renderers/d3/geo/geo-scope.js';
export const proportionalSymbolPattern = {
    id: 'proportional-symbol',
    name: 'Proportional Symbol Map',
    category: 'geo',
    description: 'Circles placed on a map, sized proportionally to data values. Avoids the area-distortion bias of choropleths.',
    bestFor: 'City-level data: population, revenue by location, earthquake magnitudes, facility capacity. Point-based metrics.',
    notFor: 'Area-based metrics (use choropleth), data without lat/lon or city names, non-geographic data.',
    dataRequirements: {
        minRows: 3,
        maxRows: 500,
        requiredColumns: [
            { type: 'categorical', count: 1, description: 'Location identifier (city, facility name)' },
            { type: 'numeric', count: 1, description: 'Value for circle sizing' },
        ],
        minCategories: 3,
    },
    selectionRules: [
        {
            condition: 'Intent mentions cities, points on map, or bubble map',
            weight: 80,
            matches: (ctx) => {
                return /\b(bubble\s*map|proportional|symbol\s*map|city|cities|point|points\s+on\s+map|location|locations)\b/i.test(ctx.intent);
            },
        },
        {
            condition: 'Data has lat/lon or coordinate columns',
            weight: 60,
            matches: (ctx) => {
                return ctx.columns.some((col) => /\b(lat|latitude|lon|longitude|lng|coord)/i.test(col.name));
            },
        },
        {
            condition: 'Penalize when no numeric column for sizing',
            weight: -40,
            matches: (ctx) => ctx.dataShape.numericColumnCount === 0,
        },
    ],
    generateSpec: (data, columns, options) => {
        const locationCol = columns[0];
        const latCol = columns.find((c) => /lat/i.test(c)) ?? null;
        const lonCol = columns.find((c) => /lon|lng/i.test(c)) ?? null;
        const coordinateCols = new Set([latCol, lonCol].filter(Boolean));
        const valueCol = columns.find((c, i) => i > 0 && !coordinateCols.has(c)) ?? columns[1] ?? columns[0];
        const geo = applyGeoScope(data, locationCol, options);
        return {
            pattern: 'proportional-symbol',
            title: options?.title ?? `${valueCol} by Location`,
            data: geo.data,
            encoding: {
                geo: { field: locationCol, type: 'nominal' },
                size: {
                    field: valueCol,
                    type: 'quantitative',
                    range: options?.sizeRange ?? [4, 40],
                },
                color: options?.colorField
                    ? { field: options.colorField, type: 'nominal' }
                    : undefined,
            },
            config: {
                locationField: locationCol,
                valueField: valueCol,
                latField: latCol,
                lonField: lonCol,
                mapType: geo.mapType,
                projection: geo.projection,
                opacity: options?.opacity ?? 0.7,
                ...buildGeoSpecConfig(geo),
            },
        };
    },
};
//# sourceMappingURL=proportional-symbol.js.map