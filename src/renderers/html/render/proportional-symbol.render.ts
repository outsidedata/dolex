import * as topojsonClient from 'topojson-client';

(globalThis as any).topojson = topojsonClient;

import { renderProportionalSymbol } from '../../d3/geo/proportional-symbol.js';
export { renderProportionalSymbol as renderChart };
