/**
 * Pattern Registry — stores all visualization patterns and provides lookup.
 *
 * The registry is the single source of truth for all available patterns.
 * Patterns register themselves on import, and the registry provides
 * methods to query patterns by ID, category, or data requirements.
 */
import type { VisualizationPattern, PatternCategory, DataRequirements } from '../types.js';
declare class PatternRegistry {
    private patterns;
    /**
     * Register a pattern. Throws if a pattern with the same ID already exists.
     */
    register(pattern: VisualizationPattern): void;
    /**
     * Get a pattern by its unique ID.
     */
    get(id: string): VisualizationPattern | undefined;
    /**
     * Get all registered patterns.
     */
    getAll(): VisualizationPattern[];
    /**
     * Get all patterns in a specific category.
     */
    getByCategory(category: PatternCategory): VisualizationPattern[];
    /**
     * Get all available categories with their pattern counts.
     */
    getCategories(): {
        category: PatternCategory;
        count: number;
        patterns: string[];
    }[];
    /**
     * Get patterns that are compatible with the given data requirements.
     * This is a structural check — it verifies that the data CAN work
     * with the pattern, not whether it SHOULD.
     */
    getCompatible(opts: {
        rowCount: number;
        numericColumnCount: number;
        categoricalColumnCount: number;
        dateColumnCount: number;
        hasHierarchy?: boolean;
        hasTimeSeries?: boolean;
    }): VisualizationPattern[];
    /**
     * Get a summary of all patterns suitable for external listing.
     */
    listPatterns(): {
        id: string;
        name: string;
        category: PatternCategory;
        description: string;
        bestFor: string;
        dataRequirements: DataRequirements;
    }[];
    /**
     * Total number of registered patterns.
     */
    get size(): number;
}
/**
 * The global pattern registry. Populated with all built-in patterns on import.
 */
export declare const registry: PatternRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map