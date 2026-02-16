/**
 * MCP Tool: refine_visualization
 * Takes a current visualization spec and a refinement request,
 * returns an updated spec.
 *
 * Supports both atomic VisualizationSpec and CompoundVisualizationSpec.
 * Accepts specId from a previous visualize/refine call.
 */
import { z } from 'zod';
export declare const refineInputSchema: z.ZodObject<{
    specId: z.ZodString;
    refinement: z.ZodString;
    selectAlternative: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refinement: string;
    specId: string;
    selectAlternative?: string | undefined;
}, {
    refinement: string;
    specId: string;
    selectAlternative?: string | undefined;
}>;
export declare function handleRefine(): (args: z.infer<typeof refineInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=refine.d.ts.map