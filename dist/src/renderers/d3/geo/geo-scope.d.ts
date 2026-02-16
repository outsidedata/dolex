import type { GeoRegionConfig } from './geo-registry.js';
import type { FuzzySuggestion } from './names/fuzzy.js';
export interface GeoScopeResult {
    scope: string;
    geoLevel?: 'country' | 'subdivision';
    confidence?: 'high' | 'medium' | 'low';
    matchedCount?: number;
    totalCount?: number;
    normalizedValues?: Map<string, string>;
    unmatchedValues?: string[];
    suggestions?: FuzzySuggestion[];
}
export declare function detectGeoScope(values: string[], options?: string | {
    intent?: string;
    columnName?: string;
}): GeoScopeResult;
export interface ApplyGeoScopeResult {
    data: Record<string, any>[];
    mapType: string;
    projection: string;
    isUs: boolean;
    regionConfig?: GeoRegionConfig;
    topojsonData?: any;
}
/**
 * Builds the config fragment for a geo spec from an ApplyGeoScopeResult.
 * Includes topoPath, objectName, nameProperty, projection overrides, and inline topojson.
 */
export declare function buildGeoSpecConfig(geo: ApplyGeoScopeResult): Record<string, any>;
export declare function applyGeoScope(data: Record<string, any>[], geoField: string, options?: Record<string, any>): ApplyGeoScopeResult;
//# sourceMappingURL=geo-scope.d.ts.map