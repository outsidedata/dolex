import { z } from 'zod';
export declare const refineInputSchema: z.ZodObject<{
    specId: z.ZodString;
    sort: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        field: z.ZodOptional<z.ZodString>;
        direction: z.ZodEnum<["asc", "desc"]>;
    }, "strip", z.ZodTypeAny, {
        direction: "asc" | "desc";
        field?: string | undefined;
    }, {
        direction: "asc" | "desc";
        field?: string | undefined;
    }>>>;
    limit: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        op: z.ZodEffects<z.ZodDefault<z.ZodEnum<["in", "not_in", "gt", "gte", "lt", "lte", "=", "!="]>>, "in" | "not_in" | "gt" | "gte" | "lt" | "lte", "=" | "!=" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | undefined>;
        values: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">;
    }, "strip", z.ZodTypeAny, {
        field: string;
        values: (string | number)[];
        op: "in" | "not_in" | "gt" | "gte" | "lt" | "lte";
    }, {
        field: string;
        values: (string | number)[];
        op?: "=" | "!=" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | undefined;
    }>, "many">>;
    flip: z.ZodOptional<z.ZodBoolean>;
    title: z.ZodOptional<z.ZodString>;
    subtitle: z.ZodOptional<z.ZodString>;
    xLabel: z.ZodOptional<z.ZodString>;
    yLabel: z.ZodOptional<z.ZodString>;
    palette: z.ZodOptional<z.ZodEnum<["categorical", "blue", "green", "purple", "warm", "blueRed", "greenPurple", "tealOrange", "redGreen", "traffic-light", "profit-loss", "temperature"]>>;
    highlight: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodObject<{
        values: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">;
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
        mutedColor: z.ZodOptional<z.ZodString>;
        mutedOpacity: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    }, {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    }>>>, {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    } | null | undefined, {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    } | null | undefined>;
    colorField: z.ZodOptional<z.ZodString>;
    flowColorBy: z.ZodOptional<z.ZodEnum<["source", "target"]>>;
    format: z.ZodOptional<z.ZodEnum<["percent", "dollar", "integer", "decimal", "compact"]>>;
    switchPattern: z.ZodOptional<z.ZodString>;
    removeTable: z.ZodOptional<z.ZodBoolean>;
    layout: z.ZodOptional<z.ZodEnum<["rows", "columns"]>>;
    hideColumns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    specId: string;
    title?: string | undefined;
    highlight?: {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    } | null | undefined;
    sort?: {
        direction: "asc" | "desc";
        field?: string | undefined;
    } | null | undefined;
    format?: "compact" | "integer" | "percent" | "dollar" | "decimal" | undefined;
    colorField?: string | undefined;
    palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    filter?: {
        field: string;
        values: (string | number)[];
        op: "in" | "not_in" | "gt" | "gte" | "lt" | "lte";
    }[] | undefined;
    subtitle?: string | undefined;
    limit?: number | undefined;
    flip?: boolean | undefined;
    xLabel?: string | undefined;
    yLabel?: string | undefined;
    flowColorBy?: "source" | "target" | undefined;
    switchPattern?: string | undefined;
    removeTable?: boolean | undefined;
    layout?: "rows" | "columns" | undefined;
    hideColumns?: string[] | undefined;
}, {
    specId: string;
    title?: string | undefined;
    highlight?: {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    } | null | undefined;
    sort?: {
        direction: "asc" | "desc";
        field?: string | undefined;
    } | null | undefined;
    format?: "compact" | "integer" | "percent" | "dollar" | "decimal" | undefined;
    colorField?: string | undefined;
    palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    filter?: {
        field: string;
        values: (string | number)[];
        op?: "=" | "!=" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | undefined;
    }[] | undefined;
    subtitle?: string | undefined;
    limit?: number | undefined;
    flip?: boolean | undefined;
    xLabel?: string | undefined;
    yLabel?: string | undefined;
    flowColorBy?: "source" | "target" | undefined;
    switchPattern?: string | undefined;
    removeTable?: boolean | undefined;
    layout?: "rows" | "columns" | undefined;
    hideColumns?: string[] | undefined;
}>;
type RefineArgs = z.infer<typeof refineInputSchema>;
export declare function handleRefine(): (args: RefineArgs) => Promise<import("./shared.js").McpResponse>;
export {};
//# sourceMappingURL=refine.d.ts.map