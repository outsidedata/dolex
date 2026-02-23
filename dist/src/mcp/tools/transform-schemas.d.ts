/**
 * Zod input schemas for the 4 derived data layer MCP tools.
 */
import { z } from 'zod';
export declare const transformDataBaseSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    create: z.ZodOptional<z.ZodString>;
    expr: z.ZodOptional<z.ZodString>;
    transforms: z.ZodOptional<z.ZodArray<z.ZodObject<{
        create: z.ZodString;
        expr: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        create: string;
        expr: string;
    }, {
        create: string;
        expr: string;
    }>, "many">>;
    type: z.ZodOptional<z.ZodEnum<["numeric", "categorical", "date", "boolean"]>>;
    filter: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
    partitionBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}>;
export declare const transformDataSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    create: z.ZodOptional<z.ZodString>;
    expr: z.ZodOptional<z.ZodString>;
    transforms: z.ZodOptional<z.ZodArray<z.ZodObject<{
        create: z.ZodString;
        expr: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        create: string;
        expr: string;
    }, {
        create: string;
        expr: string;
    }>, "many">>;
    type: z.ZodOptional<z.ZodEnum<["numeric", "categorical", "date", "boolean"]>>;
    filter: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
    partitionBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}>, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}>, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}, {
    table: string;
    sourceId: string;
    type?: "boolean" | "numeric" | "categorical" | "date" | undefined;
    filter?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    create?: string | undefined;
    expr?: string | undefined;
    transforms?: {
        create: string;
        expr: string;
    }[] | undefined;
    partitionBy?: string | undefined;
}>;
export declare const promoteColumnsSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    columns: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    columns: string[];
    table: string;
    sourceId: string;
}, {
    columns: string[];
    table: string;
    sourceId: string;
}>;
export declare const listTransformsSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
}, "strip", z.ZodTypeAny, {
    table: string;
    sourceId: string;
}, {
    table: string;
    sourceId: string;
}>;
export declare const dropColumnsSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    columns: z.ZodArray<z.ZodString, "many">;
    layer: z.ZodOptional<z.ZodEnum<["derived", "working"]>>;
}, "strip", z.ZodTypeAny, {
    columns: string[];
    table: string;
    sourceId: string;
    layer?: "derived" | "working" | undefined;
}, {
    columns: string[];
    table: string;
    sourceId: string;
    layer?: "derived" | "working" | undefined;
}>;
//# sourceMappingURL=transform-schemas.d.ts.map