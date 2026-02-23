/**
 * Dolex Derived Data Layer
 *
 * Public API for the expression-based column transform system.
 * Provides the tokenizer, parser, evaluator, dependency analysis,
 * batch execution pipeline, column manager, and manifest persistence.
 */
export { COLUMN_TYPES, manifestEntrySchema, manifestSchema, } from './types.js';
// ─── Expression Engine ──────────────────────────────────────────────────────
export { tokenize, TokenizeError } from './tokenizer.js';
export { parse, ParseError } from './parser.js';
export { evaluateExpression } from './evaluator.js';
// ─── Dependency Analysis ────────────────────────────────────────────────────
export { extractColumnRefs, buildDependencyMap, findDependents, hasCircularDependency, topologicalSort, } from './dependency.js';
export { executeSingleTransform, executeBatchTransform } from './pipeline.js';
// ─── Column Management ─────────────────────────────────────────────────────
export { ColumnManager } from './column-manager.js';
export { TransformMetadata } from './metadata.js';
// ─── Manifest Persistence ───────────────────────────────────────────────────
export { resolveManifestPath, readManifest, writeManifest, replayManifest, } from './manifest.js';
//# sourceMappingURL=index.js.map