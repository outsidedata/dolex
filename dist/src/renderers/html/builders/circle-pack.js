import { buildHtmlFromBundle } from '../template.js';
import { circlePackBundle } from '../_generated/bundles.js';
export function buildCirclePackHtml(spec) {
    return buildHtmlFromBundle(spec, circlePackBundle);
}
