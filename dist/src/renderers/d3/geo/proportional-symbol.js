/**
 * D3 renderer for proportional-symbol maps.
 *
 * Draws a base map from embedded TopoJSON data, then overlays sized
 * circles at geographic locations. Supports both lat/lon fields and
 * named city lookup for common world and US cities.
 *
 * TopoJSON is embedded at spec-generation time via `config.topojsonData`.
 * Use `config.objectName` to specify which object to extract features from.
 */
import { createSvg, buildColorScale, createTooltip, showTooltip, hideTooltip, positionTooltip, formatValue, truncateLabel, DEFAULT_PALETTE, DARK_BG, TEXT_COLOR, TEXT_MUTED, AXIS_COLOR, } from '../shared.js';
// ─── CITY COORDINATE LOOKUPS ────────────────────────────────────────────────
const WORLD_CITY_COORDS = {
    'new york': [-74.006, 40.7128],
    'london': [-0.1278, 51.5074],
    'tokyo': [139.6917, 35.6895],
    'paris': [2.3522, 48.8566],
    'beijing': [116.4074, 39.9042],
    'sydney': [151.2093, -33.8688],
    'mumbai': [72.8777, 19.076],
    'sao paulo': [-46.6333, -23.5505],
    'moscow': [37.6173, 55.7558],
    'dubai': [55.2708, 25.2048],
    'singapore': [103.8198, 1.3521],
    'hong kong': [114.1694, 22.3193],
    'los angeles': [-118.2437, 34.0522],
    'chicago': [-87.6298, 41.8781],
    'berlin': [13.405, 52.52],
    'shanghai': [121.4737, 31.2304],
    'mexico city': [-99.1332, 19.4326],
    'cairo': [31.2357, 30.0444],
    'lagos': [3.3792, 6.5244],
    'istanbul': [28.9784, 41.0082],
    'buenos aires': [-58.3816, -34.6037],
    'jakarta': [106.845, -6.2088],
    'seoul': [126.978, 37.5665],
    'toronto': [-79.3832, 43.6532],
    'san francisco': [-122.4194, 37.7749],
    'rio de janeiro': [-43.1729, -22.9068],
    'cape town': [18.4241, -33.9249],
    'nairobi': [36.8219, -1.2921],
    'bangkok': [100.5018, 13.7563],
    'delhi': [77.1025, 28.7041],
    'manila': [120.9842, 14.5995],
    'lima': [-77.0428, -12.0464],
    'bogota': [-74.0721, 4.711],
    'johannesburg': [28.0473, -26.2041],
    'tehran': [51.389, 35.6892],
    'karachi': [67.0011, 24.8607],
    'dhaka': [90.4125, 23.8103],
    'ho chi minh city': [106.6297, 10.8231],
    'kuala lumpur': [101.6869, 3.139],
    'santiago': [-70.6693, -33.4489],
};
const US_CITY_COORDS = {
    // State capitals
    'albany': [-73.7562, 42.6526],
    'annapolis': [-76.4922, 38.9784],
    'atlanta': [-84.388, 33.749],
    'augusta': [-69.7795, 44.3106],
    'austin': [-97.7431, 30.2672],
    'baton rouge': [-91.1871, 30.4515],
    'bismarck': [-100.779, 46.8083],
    'boise': [-116.2023, 43.615],
    'boston': [-71.0589, 42.3601],
    'carson city': [-119.7674, 39.1638],
    'charleston': [-81.6326, 38.3498],
    'cheyenne': [-104.8202, 41.14],
    'columbia': [-81.0348, 34.0007],
    'columbus': [-82.9988, 39.9612],
    'concord': [-71.5376, 43.2081],
    'denver': [-104.9903, 39.7392],
    'des moines': [-93.6091, 41.5868],
    'dover': [-75.5243, 39.1582],
    'frankfort': [-84.8733, 38.2009],
    'harrisburg': [-76.8867, 40.2732],
    'hartford': [-72.6823, 41.7658],
    'helena': [-112.036, 46.5891],
    'honolulu': [-157.8583, 21.3069],
    'indianapolis': [-86.1581, 39.7684],
    'jackson': [-90.1848, 32.2988],
    'jefferson city': [-92.1735, 38.5768],
    'juneau': [-134.4197, 58.3005],
    'lansing': [-84.5555, 42.7325],
    'lincoln': [-96.7026, 40.8136],
    'little rock': [-92.2896, 34.7465],
    'madison': [-89.4012, 43.0731],
    'montgomery': [-86.2999, 32.3668],
    'montpelier': [-72.5754, 44.2601],
    'nashville': [-86.7816, 36.1627],
    'oklahoma city': [-97.5164, 35.4676],
    'olympia': [-122.9007, 47.0379],
    'phoenix': [-112.074, 33.4484],
    'pierre': [-100.3511, 44.3683],
    'providence': [-71.4128, 41.824],
    'raleigh': [-78.6382, 35.7796],
    'richmond': [-77.436, 37.5407],
    'sacramento': [-121.4944, 38.5816],
    'saint paul': [-93.09, 44.9537],
    'salem': [-123.0351, 44.9429],
    'salt lake city': [-111.891, 40.7608],
    'santa fe': [-105.9378, 35.687],
    'springfield': [-89.6501, 39.7817],
    'tallahassee': [-84.2807, 30.4383],
    'topeka': [-95.6752, 39.0473],
    'trenton': [-74.7429, 40.2206],
    // Major cities
    'new york': [-74.006, 40.7128],
    'los angeles': [-118.2437, 34.0522],
    'chicago': [-87.6298, 41.8781],
    'houston': [-95.3698, 29.7604],
    'philadelphia': [-75.1652, 39.9526],
    'san antonio': [-98.4936, 29.4241],
    'san diego': [-117.1611, 32.7157],
    'dallas': [-96.797, 32.7767],
    'san francisco': [-122.4194, 37.7749],
    'seattle': [-122.3321, 47.6062],
    'miami': [-80.1918, 25.7617],
    'detroit': [-83.0458, 42.3314],
    'minneapolis': [-93.265, 44.9778],
    'tampa': [-82.4572, 27.9506],
    'portland': [-122.6765, 45.5152],
    'las vegas': [-115.1398, 36.1699],
    'baltimore': [-76.6122, 39.2904],
    'milwaukee': [-87.9065, 43.0389],
    'albuquerque': [-106.6504, 35.0844],
    'tucson': [-110.9747, 32.2226],
    'pittsburgh': [-79.9959, 40.4406],
    'cincinnati': [-84.512, 39.1031],
    'kansas city': [-94.5786, 39.0997],
    'st. louis': [-90.1994, 38.627],
    'saint louis': [-90.1994, 38.627],
    'new orleans': [-90.0715, 29.9511],
    'cleveland': [-81.6944, 41.4993],
    'orlando': [-81.3789, 28.5383],
    'charlotte': [-80.8431, 35.2271],
    'san jose': [-121.8863, 37.3382],
    'memphis': [-90.049, 35.1495],
    'louisville': [-85.7585, 38.2527],
    'buffalo': [-78.8784, 42.8864],
    'anchorage': [-149.9003, 61.2181],
};
// ─── RENDERER ────────────────────────────────────────────────────────────────
export function renderProportionalSymbol(container, spec) {
    const { config = {}, encoding, data } = spec;
    const locationField = config.locationField || (encoding.geo && encoding.geo.field);
    const valueField = config.valueField || (encoding.size && encoding.size.field);
    const latField = config.latField || null;
    const lonField = config.lonField || null;
    const sizeRange = (encoding.size && encoding.size.range) || config.sizeRange || [4, 40];
    const opacity = config.opacity ?? 0.7;
    const mapType = config.mapType || 'world';
    const objectName = config.objectName;
    const customCenter = config.center;
    const customScale = config.scale;
    const parallels = config.parallels;
    const rotate = config.rotate;
    const projection = config.projection || 'naturalEarth1';
    const topojsonData = config.topojsonData;
    if (!topojsonData) {
        container.innerHTML = '<div style="color:#ef4444;padding:20px">TopoJSON data must be embedded at spec-generation time. No CDN fetches.</div>';
        return;
    }
    const { svg, g, dims } = createSvg(container, spec, { top: 50, right: 20, bottom: 40, left: 20 });
    const tooltip = createTooltip(container);
    // Value scales
    const allValues = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
    const valExtent = d3.extent(allValues);
    const sizeScale = d3.scaleSqrt().domain(valExtent).range(sizeRange);
    // Color scale
    const colorScale = buildColorScale(encoding.color, data);
    // Merge city coordinate lookups based on map type
    const cityCoords = mapType === 'us'
        ? { ...WORLD_CITY_COORDS, ...US_CITY_COORDS }
        : { ...WORLD_CITY_COORDS };
    function renderMap(topoData) {
        var features;
        if (objectName) {
            features = topojson.feature(topoData, topoData.objects[objectName]);
        }
        else {
            var objects = topoData.objects;
            var objKey;
            if (objects.countries)
                objKey = 'countries';
            else if (objects.states)
                objKey = 'states';
            else
                objKey = Object.keys(objects)[0];
            features = topojson.feature(topoData, objects[objKey]);
        }
        var geoProjection;
        if (projection === 'albersUsa') {
            geoProjection = d3.geoAlbersUsa().fitSize([dims.innerWidth, dims.innerHeight], features);
        }
        else {
            var projName = 'geo' + projection.charAt(0).toUpperCase() + projection.slice(1);
            var projFn = d3[projName] || d3.geoNaturalEarth1;
            geoProjection = projFn();
            if (rotate)
                geoProjection.rotate(rotate);
            if (parallels && typeof geoProjection.parallels === 'function')
                geoProjection.parallels(parallels);
            if (customScale) {
                if (customCenter)
                    geoProjection.center(customCenter);
                geoProjection.scale(customScale);
                geoProjection.translate([dims.innerWidth / 2, dims.innerHeight / 2]);
            }
            else {
                geoProjection.fitSize([dims.innerWidth, dims.innerHeight], features);
            }
        }
        const path = d3.geoPath().projection(geoProjection);
        // Draw base map
        g.selectAll('path.base')
            .data(features.features)
            .enter()
            .append('path')
            .attr('class', 'base')
            .attr('d', path)
            .attr('fill', '#1a1b25')
            .attr('stroke', '#2d3041')
            .attr('stroke-width', 0.5);
        // ── Config for labels and routes ──
        const showLabels = config.showLabels === true;
        const labelField = config.labelField || locationField;
        const showRoutes = config.showRoutes === true;
        const routeGroupField = config.routeGroupField || null;
        const routeStyle = config.routeStyle || {};
        // Place circles for each data point
        const circleData = [];
        data.forEach(function (d) {
            const val = Number(d[valueField]);
            if (isNaN(val))
                return;
            let coords = null;
            let lonLat = null;
            if (latField && lonField && d[latField] != null && d[lonField] != null) {
                lonLat = [Number(d[lonField]), Number(d[latField])];
                const projected = geoProjection(lonLat);
                if (projected) {
                    coords = projected;
                }
            }
            else if (locationField) {
                const name = String(d[locationField]).toLowerCase().trim();
                const known = cityCoords[name];
                if (known) {
                    lonLat = known;
                    const projected = geoProjection(known);
                    if (projected) {
                        coords = projected;
                    }
                }
            }
            if (!coords || !lonLat)
                return;
            circleData.push({ x: coords[0], y: coords[1], lon: lonLat[0], lat: lonLat[1], value: val, datum: d });
        });
        // ── Route lines (drawn BEFORE circles so dots sit on top) ──
        if (showRoutes && circleData.length >= 2) {
            const routeColor = routeStyle.color || DEFAULT_PALETTE[0];
            const routeWidth = routeStyle.width ?? 1.5;
            const routeOpacity = routeStyle.opacity ?? 0.6;
            const routeDash = routeStyle.dash || '4,3';
            if (routeGroupField) {
                // Group points by the group field, preserving data order within each group
                const groups = new Map();
                circleData.forEach(function (cd) {
                    // Use original data order (circleData was built from data in order,
                    // but we haven't sorted yet). We need to use the original data order.
                });
                // Rebuild from original data order for route grouping
                const orderedCircleMap = new Map();
                circleData.forEach(function (cd) {
                    orderedCircleMap.set(cd.datum, cd);
                });
                data.forEach(function (d) {
                    const cd = orderedCircleMap.get(d);
                    if (!cd)
                        return;
                    const groupVal = String(d[routeGroupField]);
                    if (!groups.has(groupVal))
                        groups.set(groupVal, []);
                    groups.get(groupVal).push(cd);
                });
                let groupIdx = 0;
                groups.forEach(function (points, _groupName) {
                    if (points.length < 2) {
                        groupIdx++;
                        return;
                    }
                    const lineCoords = points.map(function (p) { return [p.lon, p.lat]; });
                    const lineGeo = { type: 'LineString', coordinates: lineCoords };
                    const groupColor = DEFAULT_PALETTE[groupIdx % DEFAULT_PALETTE.length];
                    g.append('path')
                        .datum(lineGeo)
                        .attr('class', 'route-line')
                        .attr('d', path)
                        .attr('fill', 'none')
                        .attr('stroke', groupColor)
                        .attr('stroke-width', routeWidth)
                        .attr('stroke-opacity', routeOpacity)
                        .attr('stroke-dasharray', routeDash)
                        .attr('stroke-linecap', 'round');
                    groupIdx++;
                });
            }
            else {
                // Single route through all points in data order
                // Use original data order, not size-sorted order
                const orderedPoints = [];
                const circleByDatum = new Map();
                circleData.forEach(function (cd) {
                    circleByDatum.set(cd.datum, cd);
                });
                data.forEach(function (d) {
                    const cd = circleByDatum.get(d);
                    if (cd)
                        orderedPoints.push(cd);
                });
                const lineCoords = orderedPoints.map(function (p) { return [p.lon, p.lat]; });
                const lineGeo = { type: 'LineString', coordinates: lineCoords };
                g.append('path')
                    .datum(lineGeo)
                    .attr('class', 'route-line')
                    .attr('d', path)
                    .attr('fill', 'none')
                    .attr('stroke', routeColor)
                    .attr('stroke-width', routeWidth)
                    .attr('stroke-opacity', routeOpacity)
                    .attr('stroke-dasharray', routeDash)
                    .attr('stroke-linecap', 'round');
            }
        }
        // Sort circles by size descending so smaller ones render on top
        circleData.sort((a, b) => b.value - a.value);
        // Draw circles
        g.selectAll('circle.symbol')
            .data(circleData)
            .enter()
            .append('circle')
            .attr('class', 'symbol')
            .attr('cx', (d) => d.x)
            .attr('cy', (d) => d.y)
            .attr('r', 0)
            .attr('fill', (d) => {
            if (encoding.color && encoding.color.field) {
                return typeof colorScale === 'function'
                    ? colorScale(d.datum[encoding.color.field])
                    : DEFAULT_PALETTE[0];
            }
            return DEFAULT_PALETTE[0];
        })
            .attr('fill-opacity', opacity)
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.5)
            .on('mouseover', function (event, d) {
            d3.select(this).attr('fill-opacity', 1).attr('stroke-width', 1.5);
            let html = '<strong>' + d.datum[locationField] + '</strong>';
            html += '<br/>' + valueField + ': ' + formatValue(d.value);
            if (encoding.color && encoding.color.field && encoding.color.field !== locationField) {
                html += '<br/>' + encoding.color.field + ': ' + d.datum[encoding.color.field];
            }
            showTooltip(tooltip, html, event);
        })
            .on('mousemove', function (event) {
            positionTooltip(tooltip, event);
        })
            .on('mouseout', function () {
            d3.select(this).attr('fill-opacity', opacity).attr('stroke-width', 0.5);
            hideTooltip(tooltip);
        })
            .transition()
            .duration(600)
            .delay((_d, i) => i * 20)
            .attr('r', (d) => sizeScale(d.value));
        // ── Persistent labels (drawn AFTER circles, on top) ──
        if (showLabels) {
            g.selectAll('text.label')
                .data(circleData)
                .enter()
                .append('text')
                .attr('class', 'label')
                .attr('x', (d) => {
                const r = sizeScale(d.value);
                // Flip label to the left when near right edge
                return d.x > dims.innerWidth * 0.85 ? d.x - r - 4 : d.x + r + 4;
            })
                .attr('y', (d) => d.y + 3)
                .attr('text-anchor', (d) => d.x > dims.innerWidth * 0.85 ? 'end' : 'start')
                .attr('fill', TEXT_COLOR)
                .attr('font-size', (d) => {
                const r = sizeScale(d.value);
                return Math.max(9, Math.min(12, r * 0.8)) + 'px';
            })
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .attr('pointer-events', 'none')
                .attr('opacity', (d) => sizeScale(d.value) < 3 ? 0 : 1)
                .text((d) => truncateLabel(String(d.datum[labelField] || ''), 18));
        }
        // ── Size legend (compact, bottom-left with background) ──────────────────
        const legendSizes = [valExtent[0], (valExtent[0] + valExtent[1]) / 2, valExtent[1]];
        const rawMaxR = sizeScale(valExtent[1]);
        // Cap legend circles so they don't dominate small charts
        const maxR = Math.min(rawMaxR, dims.innerHeight * 0.06, 22);
        const legendScale = maxR / rawMaxR; // ratio to shrink all legend circles proportionally
        const legendPadding = 8;
        // Measure total legend width: nested circles + text labels
        const legendCircleWidth = maxR * 2;
        const legendTextWidth = 40; // approximate
        const legendWidth = legendCircleWidth + legendTextWidth + legendPadding * 2 + 8;
        const legendHeight = maxR * 2 + legendPadding * 2;
        const legendX = 4;
        const legendY = dims.innerHeight - legendHeight - 4;
        const legendG = g.append('g').attr('transform', 'translate(' + legendX + ',' + legendY + ')');
        // Semi-transparent background
        legendG
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .attr('rx', 4)
            .attr('fill', DARK_BG)
            .attr('fill-opacity', 0.75)
            .attr('stroke', AXIS_COLOR)
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.3);
        const circleBaseX = legendPadding + maxR;
        const circleBaseY = legendPadding + maxR * 2;
        const labelPositions = [];
        const minLabelGap = 12;
        legendSizes.forEach(function (val) {
            const r = sizeScale(val) * legendScale;
            const cy = circleBaseY - r;
            legendG
                .append('circle')
                .attr('cx', circleBaseX)
                .attr('cy', cy)
                .attr('r', r)
                .attr('fill', 'none')
                .attr('stroke', AXIS_COLOR)
                .attr('stroke-width', 0.5);
            let labelY = cy + 3;
            for (const prev of labelPositions) {
                if (Math.abs(labelY - prev) < minLabelGap) {
                    labelY = prev - minLabelGap;
                }
            }
            labelPositions.push(labelY);
            legendG
                .append('text')
                .attr('x', circleBaseX + maxR + 8)
                .attr('y', labelY)
                .attr('fill', TEXT_MUTED)
                .attr('font-size', '9px')
                .attr('font-family', 'Inter, system-ui, sans-serif')
                .text(formatValue(val));
        });
    }
    renderMap(topojsonData);
}
//# sourceMappingURL=proportional-symbol.js.map