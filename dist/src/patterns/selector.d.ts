/**
 * Pattern Selection Intelligence.
 *
 * This is the core of the product. Analyzes data shape + user intent,
 * scores every registered pattern, and returns ranked recommendations
 * with reasoning.
 *
 * An LLM will always pick bar/line/pie. We pick bump charts, beeswarms,
 * slope charts, waffles — because the selection rules encode design
 * expertise that probabilistic token generation cannot.
 */
import type { DataColumn, PatternMatchContext, VisualizationRecommendation, PatternCategory } from '../types.js';
export interface SelectionResult {
    /** Best recommendation */
    recommended: VisualizationRecommendation;
    /** Alternative recommendations sorted by score */
    alternatives: VisualizationRecommendation[];
    /** The data shape analysis that drove the selection */
    dataShape: PatternMatchContext['dataShape'];
    /** The inferred intent category */
    intentCategory: PatternCategory | 'unknown';
}
/**
 * Select the best visualization pattern(s) for the given data and intent.
 *
 * This is the primary entry point for visualization intelligence.
 * It builds a data shape context, scores all patterns against it,
 * generates specs for the top recommendations, and returns them ranked.
 *
 * @param data - Array of data rows
 * @param columns - Column metadata (types, cardinality, etc.)
 * @param intent - User's description of what they want to see
 * @param options - Optional configuration
 * @returns Ranked recommendations with specs and reasoning
 */
export declare function selectPattern(data: Record<string, any>[], columns: DataColumn[], intent: string, options?: {
    /** Maximum number of alternatives to return (default: 3) */
    maxAlternatives?: number;
    /** Only consider patterns in these categories */
    filterCategories?: PatternCategory[];
    /** Exclude specific pattern IDs */
    excludePatterns?: string[];
    /** Additional options passed to generateSpec */
    specOptions?: Record<string, any>;
    /** Force a specific pattern by ID — bypasses scoring, promoted to recommended */
    forcePattern?: string;
}): SelectionResult;
/**
 * Quick recommendation: just return the single best pattern ID and a brief reason.
 * Useful for logging, debugging, or simple integrations.
 */
export declare function quickRecommend(data: Record<string, any>[], columns: DataColumn[], intent: string): {
    patternId: string;
    reasoning: string;
};
/**
 * Score a specific pattern against data without generating a spec.
 * Useful for testing individual patterns.
 */
export declare function scoreSpecificPattern(patternId: string, data: Record<string, any>[], columns: DataColumn[], intent: string): {
    score: number;
    matchedRules: {
        condition: string;
        weight: number;
    }[];
    reasoning: string;
} | null;
//# sourceMappingURL=selector.d.ts.map