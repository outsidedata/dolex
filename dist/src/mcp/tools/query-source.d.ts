/**
 * MCP Tool: query_source
 * Execute a DSL query against a source and return tabular results.
 */
import { z } from 'zod';
export declare const querySourceInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    query: z.ZodEffects<z.ZodObject<{
        join: z.ZodOptional<z.ZodArray<z.ZodObject<{
            table: z.ZodString;
            on: z.ZodObject<{
                left: z.ZodString;
                right: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                left: string;
                right: string;
            }, {
                left: string;
                right: string;
            }>;
            type: z.ZodOptional<z.ZodEnum<["inner", "left"]>>;
        }, "strip", z.ZodTypeAny, {
            table: string;
            on: {
                left: string;
                right: string;
            };
            type?: "inner" | "left" | undefined;
        }, {
            table: string;
            on: {
                left: string;
                right: string;
            };
            type?: "inner" | "left" | undefined;
        }>, "many">>;
        select: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            field: z.ZodString;
            aggregate: z.ZodEnum<["sum", "avg", "min", "max", "count", "count_distinct", "median", "p25", "p75", "stddev", "percentile"]>;
            as: z.ZodString;
            percentile: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            aggregate: "sum" | "avg" | "min" | "max" | "count" | "count_distinct" | "median" | "p25" | "p75" | "stddev" | "percentile";
            field: string;
            as: string;
            percentile?: number | undefined;
        }, {
            aggregate: "sum" | "avg" | "min" | "max" | "count" | "count_distinct" | "median" | "p25" | "p75" | "stddev" | "percentile";
            field: string;
            as: string;
            percentile?: number | undefined;
        }>, z.ZodObject<{
            window: z.ZodEnum<["lag", "lead", "rank", "dense_rank", "row_number", "running_sum", "running_avg", "pct_of_total"]>;
            field: z.ZodOptional<z.ZodString>;
            as: z.ZodString;
            partitionBy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            orderBy: z.ZodOptional<z.ZodArray<z.ZodObject<{
                field: z.ZodString;
                direction: z.ZodEnum<["asc", "desc"]>;
            }, "strip", z.ZodTypeAny, {
                field: string;
                direction: "asc" | "desc";
            }, {
                field: string;
                direction: "asc" | "desc";
            }>, "many">>;
            offset: z.ZodOptional<z.ZodNumber>;
            default: z.ZodOptional<z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            window: "lag" | "lead" | "rank" | "dense_rank" | "row_number" | "running_sum" | "running_avg" | "pct_of_total";
            as: string;
            field?: string | undefined;
            offset?: number | undefined;
            default?: any;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            partitionBy?: string[] | undefined;
        }, {
            window: "lag" | "lead" | "rank" | "dense_rank" | "row_number" | "running_sum" | "running_avg" | "pct_of_total";
            as: string;
            field?: string | undefined;
            offset?: number | undefined;
            default?: any;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            partitionBy?: string[] | undefined;
        }>]>, "many">;
        groupBy: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            field: z.ZodString;
            bucket: z.ZodEnum<["day", "week", "month", "quarter", "year"]>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        }, {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        }>]>, "many">>;
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
        having: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        orderBy: z.ZodOptional<z.ZodArray<z.ZodObject<{
            field: z.ZodString;
            direction: z.ZodEnum<["asc", "desc"]>;
        }, "strip", z.ZodTypeAny, {
            field: string;
            direction: "asc" | "desc";
        }, {
            field: string;
            direction: "asc" | "desc";
        }>, "many">>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        select: (string | {
            aggregate: "sum" | "avg" | "min" | "max" | "count" | "count_distinct" | "median" | "p25" | "p75" | "stddev" | "percentile";
            field: string;
            as: string;
            percentile?: number | undefined;
        } | {
            window: "lag" | "lead" | "rank" | "dense_rank" | "row_number" | "running_sum" | "running_avg" | "pct_of_total";
            as: string;
            field?: string | undefined;
            offset?: number | undefined;
            default?: any;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            partitionBy?: string[] | undefined;
        })[];
        join?: {
            table: string;
            on: {
                left: string;
                right: string;
            };
            type?: "inner" | "left" | undefined;
        }[] | undefined;
        filter?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        limit?: number | undefined;
    }, {
        select: (string | {
            aggregate: "sum" | "avg" | "min" | "max" | "count" | "count_distinct" | "median" | "p25" | "p75" | "stddev" | "percentile";
            field: string;
            as: string;
            percentile?: number | undefined;
        } | {
            window: "lag" | "lead" | "rank" | "dense_rank" | "row_number" | "running_sum" | "running_avg" | "pct_of_total";
            as: string;
            field?: string | undefined;
            offset?: number | undefined;
            default?: any;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            partitionBy?: string[] | undefined;
        })[];
        join?: {
            table: string;
            on: {
                left: string;
                right: string;
            };
            type?: "inner" | "left" | undefined;
        }[] | undefined;
        filter?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        limit?: number | undefined;
    }>, {
        select: (string | {
            aggregate: "sum" | "avg" | "min" | "max" | "count" | "count_distinct" | "median" | "p25" | "p75" | "stddev" | "percentile";
            field: string;
            as: string;
            percentile?: number | undefined;
        } | {
            window: "lag" | "lead" | "rank" | "dense_rank" | "row_number" | "running_sum" | "running_avg" | "pct_of_total";
            as: string;
            field?: string | undefined;
            offset?: number | undefined;
            default?: any;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            partitionBy?: string[] | undefined;
        })[];
        join?: {
            table: string;
            on: {
                left: string;
                right: string;
            };
            type?: "inner" | "left" | undefined;
        }[] | undefined;
        filter?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        limit?: number | undefined;
    }, unknown>;
    maxRows: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    table: string;
    query: {
        select: (string | {
            aggregate: "sum" | "avg" | "min" | "max" | "count" | "count_distinct" | "median" | "p25" | "p75" | "stddev" | "percentile";
            field: string;
            as: string;
            percentile?: number | undefined;
        } | {
            window: "lag" | "lead" | "rank" | "dense_rank" | "row_number" | "running_sum" | "running_avg" | "pct_of_total";
            as: string;
            field?: string | undefined;
            offset?: number | undefined;
            default?: any;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            partitionBy?: string[] | undefined;
        })[];
        join?: {
            table: string;
            on: {
                left: string;
                right: string;
            };
            type?: "inner" | "left" | undefined;
        }[] | undefined;
        filter?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        limit?: number | undefined;
    };
    sourceId: string;
    maxRows?: number | undefined;
}, {
    table: string;
    sourceId: string;
    query?: unknown;
    maxRows?: number | undefined;
}>;
export declare function handleQuerySource(deps: {
    sourceManager: any;
}): (args: z.infer<typeof querySourceInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=query-source.d.ts.map