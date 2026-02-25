/**
 * MCP Tool: export_html
 * Returns the full rendered HTML for a previously-created visualization.
 * Accepts a specId from a visualize or refine call.
 *
 * Designed for programmatic consumption — the returned HTML is a complete,
 * self-contained document that can be opened in a browser or screenshotted.
 *
 * When writeTo is provided, writes to disk instead of returning in response (saves tokens).
 */

import { z } from 'zod';
import { specStore } from '../spec-store.js';
import { errorResponse, buildOutputHtml, writeHtmlToDisk } from './shared.js';

export const exportHtmlInputSchema = z.object({
  specId: z.string().describe('Spec ID from a previous visualize or refine call'),
  writeTo: z.string().optional().describe('File path to write HTML to. If provided, writes to disk and returns path instead of HTML content (saves tokens).'),
});

export function handleExportHtml() {
  return async (args: z.infer<typeof exportHtmlInputSchema>) => {
    const stored = specStore.get(args.specId);
    if (!stored) {
      return errorResponse(`Spec "${args.specId}" not found or expired. Create a new visualization first.`);
    }

    const html = buildOutputHtml(stored.spec);
    if (!html) {
      return errorResponse(`Spec "${args.specId}" does not have an HTML builder.`);
    }

    if (args.writeTo) {
      const writeResult = writeHtmlToDisk(html, args.writeTo);
      if (!writeResult.ok) return errorResponse(writeResult.error);
      return {
        content: [{ type: 'text' as const, text: writeResult.message }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: html }],
    };
  };
}
