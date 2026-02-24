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
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { isCompoundSpec } from '../../types.js';
import { buildChartHtml, isHtmlPatternSupported } from '../../renderers/html/index.js';
import { buildCompoundHtml } from '../../renderers/html/builders/compound.js';
import { specStore } from '../spec-store.js';
import { errorResponse } from './shared.js';
import { refineInputSchema, handleRefine } from './refine.js';
// Extend the refine schema with required writeTo
export const refineCliInputSchema = refineInputSchema.extend({
    writeTo: z.string().describe('REQUIRED. File path to write the refined HTML chart to. The HTML is written to disk and NOT returned in the response.'),
});
function buildOutputHtml(spec) {
    if (isCompoundSpec(spec)) {
        return buildCompoundHtml(spec);
    }
    if (isHtmlPatternSupported(spec.pattern)) {
        return buildChartHtml(spec);
    }
    return undefined;
}
export function handleRefineCli() {
    // Get the base refine handler to reuse its logic
    const baseRefine = handleRefine();
    return async (args) => {
        // Call the base refine to do all the spec manipulation
        const stored = specStore.get(args.specId);
        if (!stored) {
            return errorResponse(`Spec "${args.specId}" not found. It may have expired. Re-run visualize to get a new specId.`);
        }
        // Run base refine (it will update the spec store)
        const baseResult = await baseRefine(args);
        // Extract the response body from base result
        const textContent = baseResult.content.find((c) => c.type === 'text');
        if (!textContent) {
            return errorResponse('Unexpected error: no text content from refine');
        }
        const body = JSON.parse(textContent.text);
        const newSpecId = body.specId;
        // Get the updated spec and build HTML
        const updatedStored = specStore.get(newSpecId);
        if (!updatedStored) {
            return errorResponse('Unexpected error: refined spec not found');
        }
        const outputHtml = buildOutputHtml(updatedStored.spec);
        // Write HTML to disk
        let writeResult;
        if (outputHtml) {
            try {
                mkdirSync(dirname(args.writeTo), { recursive: true });
                writeFileSync(args.writeTo, outputHtml, 'utf-8');
                writeResult = `Wrote ${outputHtml.length} bytes to ${args.writeTo}`;
            }
            catch (err) {
                return errorResponse(`Failed to write to ${args.writeTo}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        else {
            const pattern = isCompoundSpec(updatedStored.spec)
                ? updatedStored.spec.views?.find((v) => v.type === 'chart')?.chart?.pattern
                : updatedStored.spec.pattern;
            writeResult = `No HTML builder for pattern "${pattern}"`;
        }
        // Add write info to response
        body.writeTo = args.writeTo;
        body.writeResult = writeResult;
        // CLI tools NEVER return structuredContent - just text
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(body, null, 2),
                }],
        };
    };
}
//# sourceMappingURL=refine-cli.js.map