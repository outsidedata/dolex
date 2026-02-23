/**
 * Dependency analysis for the Dolex derived data layer.
 *
 * Extracts column references from ASTs, builds dependency graphs,
 * detects cycles, and produces topological orderings.
 */
import type { AstNode, TransformRecord } from './types.js';
/** Extract all column references from an AST. */
export declare function extractColumnRefs(ast: AstNode): string[];
/** Build a dependency map: column → columns it references. */
export declare function buildDependencyMap(records: TransformRecord[]): Map<string, Set<string>>;
/** Find columns that depend on the given column (direct and transitive). */
export declare function findDependents(column: string, records: TransformRecord[]): string[];
/** Check for circular dependencies when adding a new transform. */
export declare function hasCircularDependency(newColumn: string, newExpr: string, existingRecords: TransformRecord[]): {
    circular: boolean;
    cycle?: string[];
};
/** Sort records in dependency-safe order (dependencies before dependents). */
export declare function topologicalSort(records: TransformRecord[]): TransformRecord[];
//# sourceMappingURL=dependency.d.ts.map