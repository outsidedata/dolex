import { buildHtmlFromBundle } from '../template.js';
import { histogramBundle } from '../_generated/bundles.js';
export function buildHistogramHtml(spec) {
    return buildHtmlFromBundle(spec, histogramBundle);
}
