import { buildHtmlFromBundle } from '../template.js';
import { stackedBarBundle } from '../_generated/bundles.js';
export function buildStackedBarHtml(spec) {
    return buildHtmlFromBundle(spec, stackedBarBundle);
}
