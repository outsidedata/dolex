/**
 * MCP Tool: refine_visualization_cli_only
 *
 * FOR CLAUDE CODE / CLI USE ONLY. DO NOT USE IN CLAUDE DESKTOP.
 *
 * Same as refine_visualization but:
 * - NEVER returns HTML in response
 * - Writes HTML directly to disk via writeTo parameter
 * - Returns only specId and changes
 */

import { z } from 'zod';
import { specStore } from '../spec-store.js';
import { errorResponse, buildOutputHtml, writeHtmlToDisk } from './shared.js';
import { refineInputSchema, handleRefine } from './refine.js';

export const refineCliInputSchema = refineInputSchema.extend({
  writeTo: z.string().describe('REQUIRED. File path to write the refined HTML chart to. The HTML is written to disk and NOT returned in the response.'),
});

export function handleRefineCli() {
  const baseRefine = handleRefine();

  return async (args: z.infer<typeof refineCliInputSchema>) => {
    const stored = specStore.get(args.specId);
    if (!stored) {
      return errorResponse(`Spec "${args.specId}" not found. It may have expired. Re-run visualize to get a new specId.`);
    }

    const baseResult = await baseRefine(args);

    const textContent = baseResult.content.find((c: any) => c.type === 'text');
    if (!textContent) {
      return errorResponse('Unexpected error: no text content from refine');
    }

    const body = JSON.parse(textContent.text);
    const newSpecId = body.specId;

    const updatedStored = specStore.get(newSpecId);
    if (!updatedStored) {
      return errorResponse('Unexpected error: refined spec not found');
    }

    const outputHtml = buildOutputHtml(updatedStored.spec);

    if (outputHtml) {
      const writeResult = writeHtmlToDisk(outputHtml, args.writeTo);
      if (!writeResult.ok) return errorResponse(writeResult.error);
      body.writeTo = args.writeTo;
      body.writeResult = writeResult.message;
    } else {
      body.writeTo = args.writeTo;
      body.writeResult = `No HTML builder for current pattern`;
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(body, null, 2),
      }],
    };
  };
}
