export interface GeoRegionConfig {
    geoLevel: 'country' | 'subdivision';
    label: string;
    projection: string;
    topoPath: string;
    objectName: string;
    nameProperty: string;
    subdivisionType?: string;
    rotate?: [number, number, number];
    parallels?: [number, number];
    center?: [number, number];
    scale?: number;
}
export declare function getGeoConfig(region: string): GeoRegionConfig | undefined;
export declare function getAllGeoRegions(): string[];
export declare function getSubdivisionRegions(): string[];
export declare function getCountryRegions(): string[];
//# sourceMappingURL=geo-registry.d.ts.map