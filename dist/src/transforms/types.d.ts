/**
 * Types for the Dolex derived data layer.
 *
 * Expression tokenizer, parser, evaluator, and transform pipeline types.
 */
import { z } from 'zod';
import type { RowFilter } from '../types.js';
export type TokenType = 'NUMBER' | 'STRING' | 'IDENT' | 'BACKTICK_IDENT' | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'PERCENT' | 'CARET' | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COMMA' | 'EOF';
export interface Token {
    type: TokenType;
    value: string;
    /** Character offset in the source string */
    pos: number;
}
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
export type AstNode = NumberLiteral | StringLiteral | BooleanLiteral | ColumnRef | BinaryOp | UnaryOp | FunctionCall | ArrayLiteral;
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
export declare const manifestEntrySchema: z.ZodObject<{
    column: z.ZodString;
    expr: z.ZodString;
    type: z.ZodEnum<["numeric", "categorical", "date", "boolean"]>;
    partitionBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "boolean" | "numeric" | "categorical" | "date";
    expr: string;
    column: string;
    partitionBy?: string | undefined;
}, {
    type: "boolean" | "numeric" | "categorical" | "date";
    expr: string;
    column: string;
    partitionBy?: string | undefined;
}>;
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export declare const manifestSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    tables: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        column: z.ZodString;
        expr: z.ZodString;
        type: z.ZodEnum<["numeric", "categorical", "date", "boolean"]>;
        partitionBy: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "boolean" | "numeric" | "categorical" | "date";
        expr: string;
        column: string;
        partitionBy?: string | undefined;
    }, {
        type: "boolean" | "numeric" | "categorical" | "date";
        expr: string;
        column: string;
        partitionBy?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    tables: Record<string, {
        type: "boolean" | "numeric" | "categorical" | "date";
        expr: string;
        column: string;
        partitionBy?: string | undefined;
    }[]>;
    version: 1;
}, {
    tables: Record<string, {
        type: "boolean" | "numeric" | "categorical" | "date";
        expr: string;
        column: string;
        partitionBy?: string | undefined;
    }[]>;
    version: 1;
}>;
export type ManifestData = z.infer<typeof manifestSchema>;
export type ColumnType = 'numeric' | 'categorical' | 'date' | 'boolean';
export declare const COLUMN_TYPES: readonly ColumnType[];
export interface TransformStats {
    min?: number;
    max?: number;
    mean?: number;
    nulls: number;
    rows: number;
}
//# sourceMappingURL=types.d.ts.map