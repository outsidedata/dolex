/**
 * Types for the Dolex derived data layer.
 *
 * Expression tokenizer, parser, evaluator, and transform pipeline types.
 */
import { z } from 'zod';
import type { RowFilter } from '../types.js';

// ─── TOKEN TYPES ─────────────────────────────────────────────────────────────

export type TokenType =
  | 'NUMBER' | 'STRING' | 'IDENT' | 'BACKTICK_IDENT'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'CARET'
  | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE'
  | 'AND' | 'OR' | 'NOT'
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  /** Character offset in the source string */
  pos: number;
}

// ─── AST NODE TYPES ──────────────────────────────────────────────────────────

export interface NumberLiteral {
  type: 'number';
  value: number;
}

export interface StringLiteral {
  type: 'string';
  value: string;
}

export interface BooleanLiteral {
  type: 'boolean';
  value: boolean;
}

export interface ColumnRef {
  type: 'column';
  name: string;
}

export interface BinaryOp {
  type: 'binary';
  op: string;
  left: AstNode;
  right: AstNode;
}

export interface UnaryOp {
  type: 'unary';
  op: string;
  operand: AstNode;
}

export interface FunctionCall {
  type: 'call';
  name: string;
  args: AstNode[];
}

export interface ArrayLiteral {
  type: 'array';
  elements: AstNode[];
}

export type AstNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | ColumnRef
  | BinaryOp
  | UnaryOp
  | FunctionCall
  | ArrayLiteral;

// ─── TRANSFORM METADATA TYPES ───────────────────────────────────────────────

export type ColumnLayer = 'source' | 'derived' | 'working';

export interface TransformRecord {
  column: string;
  expr: string;
  type: 'numeric' | 'categorical' | 'date' | 'boolean';
  layer: ColumnLayer;
  /** Execution order within the manifest */
  order: number;
  partitionBy?: string;
  filter?: RowFilter[];
}

export interface TransformResult {
  column: string;
  expr: string;
  type: string;
  layer: ColumnLayer;
  overwritten: boolean;
  stats: {
    min?: number;
    max?: number;
    mean?: number;
    nulls: number;
    rows: number;
  };
}

// ─── MANIFEST ZOD SCHEMA ────────────────────────────────────────────────────

export const manifestEntrySchema = z.object({
  column: z.string(),
  expr: z.string(),
  type: z.enum(['numeric', 'categorical', 'date', 'boolean']),
  partitionBy: z.string().optional(),
});

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;

export const manifestSchema = z.object({
  version: z.literal(1),
  tables: z.record(z.string(), z.array(manifestEntrySchema)),
});

export type ManifestData = z.infer<typeof manifestSchema>;

// ─── COLUMN TYPE & STATS ───────────────────────────────────────────────────

export type ColumnType = 'numeric' | 'categorical' | 'date' | 'boolean';

export const COLUMN_TYPES: readonly ColumnType[] = ['numeric', 'categorical', 'date', 'boolean'] as const;

export interface TransformStats {
  min?: number;
  max?: number;
  mean?: number;
  nulls: number;
  rows: number;
}
