import { buildHtmlFromBundle } from '../template.js';
import { divergingBarBundle } from '../_generated/bundles.js';
export function buildDivergingBarHtml(spec) {
    return buildHtmlFromBundle(spec, divergingBarBundle);
}
