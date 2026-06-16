import { buildHtmlFromBundle } from '../template.js';
import { smallMultiplesBundle } from '../_generated/bundles.js';
export function buildSmallMultiplesHtml(spec) {
    return buildHtmlFromBundle(spec, smallMultiplesBundle);
}
