/**
 * Pattern-selection callback — bridges a VisualizeInput to a VisualizeOutput
 * by running the core `selectPattern` selector and mapping pattern objects to
 * their ids.
 *
 * Shared by both frontends (the MCP server and the CLI) so the bridging logic
 * lives in exactly one place.
 */
import { selectPattern } from './selector.js';
export function selectPatternsCallback(input) {
    const columns = input.columns ?? [];
    const specOptions = {};
    if (input.geoLevel)
        specOptions.geoLevel = input.geoLevel;
    if (input.geoRegion)
        specOptions.geoRegion = input.geoRegion;
    const result = selectPattern(input.data, columns, input.intent, {
        forcePattern: input.forcePattern,
        specOptions,
    });
    return {
        recommended: {
            pattern: result.recommended.pattern.id,
            spec: result.recommended.spec,
            reasoning: result.recommended.reasoning,
        },
        alternatives: result.alternatives.map((a) => ({
            pattern: a.pattern.id,
            spec: a.spec,
            reasoning: a.reasoning,
        })),
    };
}
