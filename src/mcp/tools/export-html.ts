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
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import { errorResponse } from './shared.js';

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

    const { spec } = stored;
    let html: string;

    if (isCompoundSpec(spec)) {
      html = buildCompoundHtml(spec);
    } else if (isHtmlPatternSupported(spec.pattern)) {
      html = buildChartHtml(spec);
    } else {
      return errorResponse(`Pattern "${spec.pattern}" does not have an HTML builder.`);
    }

    // Write to disk if path provided
    if (args.writeTo) {
      try {
        mkdirSync(dirname(args.writeTo), { recursive: true });
        writeFileSync(args.writeTo, html, 'utf-8');
        return {
          content: [{ type: 'text' as const, text: `Wrote ${html.length} bytes to ${args.writeTo}` }],
        };
      } catch (err) {
        return errorResponse(`Failed to write to ${args.writeTo}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Return HTML in response (original behavior)
    return {
      content: [{ type: 'text' as const, text: html }],
    };
  };
}
