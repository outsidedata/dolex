/**
 * Shared geo projection setup used by choropleth and proportional-symbol renderers.
 *
 * Extracts TopoJSON features and constructs a fitted D3 projection + path generator.
 */
export interface GeoProjectionConfig {
    projection?: string;
    objectName?: string;
    center?: [number, number];
    scale?: number;
    parallels?: [number, number];
    rotate?: [number, number, number];
}
export interface GeoProjectionResult {
    features: any;
    projection: any;
    path: any;
}
/**
 * Extract TopoJSON features and build a fitted D3 geo projection + path generator.
 *
 * Handles object name resolution (explicit objectName, or auto-detect countries/states/first key),
 * projection type selection (albersUsa special case, or generic geo* lookup with fallback),
 * and fitSize logic (custom scale+center+translate vs automatic fitSize).
 */
export declare function buildGeoProjection(topoData: any, config: GeoProjectionConfig, dims: {
    innerWidth: number;
    innerHeight: number;
}): GeoProjectionResult;
