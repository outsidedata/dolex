/**
 * Dolex Derived Data Layer
 *
 * Public API for the expression-based column transform system.
 * Provides the tokenizer, parser, evaluator, dependency analysis,
 * batch execution pipeline, column manager, and manifest persistence.
 */
export type { TokenType, Token, NumberLiteral, StringLiteral, BooleanLiteral, ColumnRef, BinaryOp, UnaryOp, FunctionCall, ArrayLiteral, AstNode, ColumnType, ColumnLayer, TransformStats, TransformRecord, TransformResult, ManifestEntry, ManifestData, } from './types.js';
export { COLUMN_TYPES, manifestEntrySchema, manifestSchema, } from './types.js';
export { tokenize, TokenizeError } from './tokenizer.js';
export { parse, ParseError } from './parser.js';
export { evaluateExpression } from './evaluator.js';
export { extractColumnRefs, buildDependencyMap, findDependents, hasCircularDependency, topologicalSort, } from './dependency.js';
export type { TransformInput, BatchTransformInput, TransformOutput } from './pipeline.js';
export { executeSingleTransform, executeBatchTransform } from './pipeline.js';
export { ColumnManager } from './column-manager.js';
export { TransformMetadata } from './metadata.js';
export { resolveManifestPath, readManifest, writeManifest, replayManifest, } from './manifest.js';
//# sourceMappingURL=index.d.ts.map