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
import type { VisualizationSpec } from '../../../types.js';
export declare function renderProportionalSymbol(container: HTMLElement, spec: VisualizationSpec): void;
//# sourceMappingURL=proportional-symbol.d.ts.map