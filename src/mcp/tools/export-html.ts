/**
 * MCP Tool: export_html
 * Returns the full rendered HTML for a previously-created visualization.
 * Accepts a specId from a visualize, visualize_from_source, or refine call.
 *
 * Designed for programmatic consumption — the returned HTML is a complete,
 * self-contained document that can be opened in a browser or screenshotted.
 */

import { z } from 'zod';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import { errorResponse } from './shared.js';

export const exportHtmlInputSchema = z.object({
  specId: z.string().describe('Spec ID from a previous visualize, visualize_from_source, or refine call'),
});

export function handleExportHtml() {
  return async (args: z.infer<typeof exportHtmlInputSchema>) => {
    const stored = specStore.get(args.specId);
    if (!stored) {
      return errorResponse(`Spec "${args.specId}" not found or expired. Create a new visualization first.`);
    }

    const { spec } = stored;

    if (isCompoundSpec(spec)) {
      const html = buildCompoundHtml(spec);
      return {
        content: [{ type: 'text' as const, text: html }],
      };
    }

    if (!isHtmlPatternSupported(spec.pattern)) {
      return errorResponse(`Pattern "${spec.pattern}" does not have an HTML builder.`);
    }

    const html = buildChartHtml(spec);
    return {
      content: [{ type: 'text' as const, text: html }],
    };
  };
}
