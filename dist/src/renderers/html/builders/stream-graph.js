import { buildHtmlFromBundle } from '../template.js';
import { streamGraphBundle } from '../_generated/bundles.js';
export function buildStreamGraphHtml(spec) {
    return buildHtmlFromBundle(spec, streamGraphBundle);
}
