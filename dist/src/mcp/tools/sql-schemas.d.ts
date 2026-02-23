/**
 * Shared Zod schemas for the SQL query layer.
 * Used by query_data and the visualize tool.
 */
import { z } from 'zod';
export declare const rowFilterSchema: z.ZodObject<{
    field: z.ZodString;
    op: z.ZodEnum<["=", "!=", ">", ">=", "<", "<=", "in", "not_in", "between", "is_null", "is_not_null"]>;
    value: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    field: string;
    op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
    value?: any;
}, {
    field: string;
    op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
    value?: any;
}>;
export declare const ALL_PALETTE_NAMES: readonly ["categorical", "blue", "green", "purple", "warm", "blueRed", "greenPurple", "tealOrange", "redGreen", "traffic-light", "profit-loss", "temperature"];
//# sourceMappingURL=sql-schemas.d.ts.map