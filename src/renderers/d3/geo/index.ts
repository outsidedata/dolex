export { renderChoropleth } from './choropleth.js';
export { renderProportionalSymbol } from './proportional-symbol.js';
export { buildGeoProjection } from './projection-utils.js';
export type { GeoProjectionConfig, GeoProjectionResult } from './projection-utils.js';
export { detectGeoScope, applyGeoScope, buildGeoSpecConfig } from './geo-scope.js';
export type { GeoScopeResult, ApplyGeoScopeResult } from './geo-scope.js';
export { getGeoConfig, getAllGeoRegions, getSubdivisionRegions, getCountryRegions } from './geo-registry.js';
export type { GeoRegionConfig } from './geo-registry.js';
