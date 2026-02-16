import * as topojsonClient from 'topojson-client';

(globalThis as any).topojson = topojsonClient;

import { renderChoropleth } from '../../d3/geo/choropleth.js';
export { renderChoropleth as renderChart };
