/**
 * Shared geo projection setup used by choropleth and proportional-symbol renderers.
 *
 * Extracts TopoJSON features and constructs a fitted D3 projection + path generator.
 */
/**
 * Extract TopoJSON features and build a fitted D3 geo projection + path generator.
 *
 * Handles object name resolution (explicit objectName, or auto-detect countries/states/first key),
 * projection type selection (albersUsa special case, or generic geo* lookup with fallback),
 * and fitSize logic (custom scale+center+translate vs automatic fitSize).
 */
export function buildGeoProjection(topoData, config, dims) {
    const { projection = 'naturalEarth1', objectName, center: customCenter, scale: customScale, parallels, rotate, } = config;
    // ── Extract features from TopoJSON ──
    let features;
    if (objectName) {
        features = topojson.feature(topoData, topoData.objects[objectName]);
    }
    else {
        const objects = topoData.objects;
        let objKey;
        if (objects.countries)
            objKey = 'countries';
        else if (objects.states)
            objKey = 'states';
        else
            objKey = Object.keys(objects)[0];
        features = topojson.feature(topoData, objects[objKey]);
    }
    // ── Build projection ──
    let geoProjection;
    if (projection === 'albersUsa') {
        geoProjection = d3.geoAlbersUsa().fitSize([dims.innerWidth, dims.innerHeight], features);
    }
    else {
        const projName = 'geo' + projection.charAt(0).toUpperCase() + projection.slice(1);
        const projFn = d3[projName] || d3.geoNaturalEarth1;
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
    return { features, projection: geoProjection, path };
}
