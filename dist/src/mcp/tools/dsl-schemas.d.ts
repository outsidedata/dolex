/**
 * Shared Zod schemas for the query DSL.
 * Used by both query_data and visualize_data tools.
 */
import { z } from 'zod';
export declare function normalizeDslQueryInput(raw: unknown): unknown;
export declare const dslJoinSchema: z.ZodObject<{
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
}>;
export declare const dslAggregateFieldSchema: z.ZodObject<{
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
}>;
export declare const dslWindowFieldSchema: z.ZodObject<{
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
}>;
export declare const dslSelectFieldSchema: z.ZodUnion<[z.ZodString, z.ZodObject<{
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
}>]>;
export declare const dslGroupByFieldSchema: z.ZodUnion<[z.ZodString, z.ZodObject<{
    field: z.ZodString;
    bucket: z.ZodEnum<["day", "week", "month", "quarter", "year"]>;
}, "strip", z.ZodTypeAny, {
    field: string;
    bucket: "day" | "week" | "month" | "quarter" | "year";
}, {
    field: string;
    bucket: "day" | "week" | "month" | "quarter" | "year";
}>]>;
export declare const dslFilterSchema: z.ZodObject<{
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
export declare const dslQuerySchema: z.ZodEffects<z.ZodObject<{
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
    having?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    orderBy?: {
        field: string;
        direction: "asc" | "desc";
    }[] | undefined;
    groupBy?: (string | {
        field: string;
        bucket: "day" | "week" | "month" | "quarter" | "year";
    })[] | undefined;
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
    having?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    orderBy?: {
        field: string;
        direction: "asc" | "desc";
    }[] | undefined;
    groupBy?: (string | {
        field: string;
        bucket: "day" | "week" | "month" | "quarter" | "year";
    })[] | undefined;
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
    having?: {
        field: string;
        op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
        value?: any;
    }[] | undefined;
    orderBy?: {
        field: string;
        direction: "asc" | "desc";
    }[] | undefined;
    groupBy?: (string | {
        field: string;
        bucket: "day" | "week" | "month" | "quarter" | "year";
    })[] | undefined;
    limit?: number | undefined;
}, unknown>;
export declare const ALL_PALETTE_NAMES: readonly ["categorical", "blue", "green", "purple", "warm", "blueRed", "greenPurple", "tealOrange", "redGreen", "traffic-light", "profit-loss", "temperature"];
export declare const dashboardViewSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    intent: z.ZodString;
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
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
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
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
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
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
        limit?: number | undefined;
    }, unknown>;
    pattern: z.ZodOptional<z.ZodString>;
    colorPreferences: z.ZodOptional<z.ZodObject<{
        palette: z.ZodOptional<z.ZodEnum<["categorical", "blue", "green", "purple", "warm", "blueRed", "greenPurple", "tealOrange", "redGreen", "traffic-light", "profit-loss", "temperature"]>>;
        highlight: z.ZodOptional<z.ZodObject<{
            values: z.ZodArray<z.ZodAny, "many">;
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
            mutedColor: z.ZodOptional<z.ZodString>;
            mutedOpacity: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            values: any[];
            color?: string | string[] | undefined;
            mutedColor?: string | undefined;
            mutedOpacity?: number | undefined;
        }, {
            values: any[];
            color?: string | string[] | undefined;
            mutedColor?: string | undefined;
            mutedOpacity?: number | undefined;
        }>>;
        colorField: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        highlight?: {
            values: any[];
            color?: string | string[] | undefined;
            mutedColor?: string | undefined;
            mutedOpacity?: number | undefined;
        } | undefined;
        colorField?: string | undefined;
        palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    }, {
        highlight?: {
            values: any[];
            color?: string | string[] | undefined;
            mutedColor?: string | undefined;
            mutedOpacity?: number | undefined;
        } | undefined;
        colorField?: string | undefined;
        palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    }>>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    intent: string;
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
        having?: {
            field: string;
            op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
            value?: any;
        }[] | undefined;
        orderBy?: {
            field: string;
            direction: "asc" | "desc";
        }[] | undefined;
        groupBy?: (string | {
            field: string;
            bucket: "day" | "week" | "month" | "quarter" | "year";
        })[] | undefined;
        limit?: number | undefined;
    };
    pattern?: string | undefined;
    config?: Record<string, any> | undefined;
    colorPreferences?: {
        highlight?: {
            values: any[];
            color?: string | string[] | undefined;
            mutedColor?: string | undefined;
            mutedOpacity?: number | undefined;
        } | undefined;
        colorField?: string | undefined;
        palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    } | undefined;
}, {
    id: string;
    title: string;
    intent: string;
    pattern?: string | undefined;
    config?: Record<string, any> | undefined;
    query?: unknown;
    colorPreferences?: {
        highlight?: {
            values: any[];
            color?: string | string[] | undefined;
            mutedColor?: string | undefined;
            mutedOpacity?: number | undefined;
        } | undefined;
        colorField?: string | undefined;
        palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    } | undefined;
}>;
export declare const dashboardFilterSchema: z.ZodObject<{
    field: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["select", "multi-select", "range", "date-range"]>;
    values: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    currentValue: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    type: "select" | "multi-select" | "range" | "date-range";
    field: string;
    label?: string | undefined;
    values?: any[] | undefined;
    currentValue?: any;
}, {
    type: "select" | "multi-select" | "range" | "date-range";
    field: string;
    label?: string | undefined;
    values?: any[] | undefined;
    currentValue?: any;
}>;
export declare const dashboardLayoutSchema: z.ZodObject<{
    columns: z.ZodNumber;
    viewSizes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        colSpan: z.ZodOptional<z.ZodNumber>;
        rowSpan: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        colSpan?: number | undefined;
        rowSpan?: number | undefined;
    }, {
        colSpan?: number | undefined;
        rowSpan?: number | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    columns: number;
    viewSizes?: Record<string, {
        colSpan?: number | undefined;
        rowSpan?: number | undefined;
    }> | undefined;
}, {
    columns: number;
    viewSizes?: Record<string, {
        colSpan?: number | undefined;
        rowSpan?: number | undefined;
    }> | undefined;
}>;
export declare const dashboardInteractionSchema: z.ZodObject<{
    type: z.ZodEnum<["crossfilter", "highlight"]>;
    field: z.ZodString;
    views: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "highlight" | "crossfilter";
    field: string;
    views?: string[] | undefined;
}, {
    type: "highlight" | "crossfilter";
    field: string;
    views?: string[] | undefined;
}>;
export declare const createDashboardInputSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    views: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        intent: z.ZodString;
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
            having?: {
                field: string;
                op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
                value?: any;
            }[] | undefined;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: (string | {
                field: string;
                bucket: "day" | "week" | "month" | "quarter" | "year";
            })[] | undefined;
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
            having?: {
                field: string;
                op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
                value?: any;
            }[] | undefined;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: (string | {
                field: string;
                bucket: "day" | "week" | "month" | "quarter" | "year";
            })[] | undefined;
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
            having?: {
                field: string;
                op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
                value?: any;
            }[] | undefined;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: (string | {
                field: string;
                bucket: "day" | "week" | "month" | "quarter" | "year";
            })[] | undefined;
            limit?: number | undefined;
        }, unknown>;
        pattern: z.ZodOptional<z.ZodString>;
        colorPreferences: z.ZodOptional<z.ZodObject<{
            palette: z.ZodOptional<z.ZodEnum<["categorical", "blue", "green", "purple", "warm", "blueRed", "greenPurple", "tealOrange", "redGreen", "traffic-light", "profit-loss", "temperature"]>>;
            highlight: z.ZodOptional<z.ZodObject<{
                values: z.ZodArray<z.ZodAny, "many">;
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString, "many">]>>;
                mutedColor: z.ZodOptional<z.ZodString>;
                mutedOpacity: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            }, {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            }>>;
            colorField: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            highlight?: {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            } | undefined;
            colorField?: string | undefined;
            palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
        }, {
            highlight?: {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            } | undefined;
            colorField?: string | undefined;
            palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
        }>>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        intent: string;
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
            having?: {
                field: string;
                op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
                value?: any;
            }[] | undefined;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: (string | {
                field: string;
                bucket: "day" | "week" | "month" | "quarter" | "year";
            })[] | undefined;
            limit?: number | undefined;
        };
        pattern?: string | undefined;
        config?: Record<string, any> | undefined;
        colorPreferences?: {
            highlight?: {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            } | undefined;
            colorField?: string | undefined;
            palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
        } | undefined;
    }, {
        id: string;
        title: string;
        intent: string;
        pattern?: string | undefined;
        config?: Record<string, any> | undefined;
        query?: unknown;
        colorPreferences?: {
            highlight?: {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            } | undefined;
            colorField?: string | undefined;
            palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
        } | undefined;
    }>, "many">;
    globalFilters: z.ZodOptional<z.ZodArray<z.ZodObject<{
        field: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["select", "multi-select", "range", "date-range"]>;
        values: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        currentValue: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        type: "select" | "multi-select" | "range" | "date-range";
        field: string;
        label?: string | undefined;
        values?: any[] | undefined;
        currentValue?: any;
    }, {
        type: "select" | "multi-select" | "range" | "date-range";
        field: string;
        label?: string | undefined;
        values?: any[] | undefined;
        currentValue?: any;
    }>, "many">>;
    layout: z.ZodOptional<z.ZodObject<{
        columns: z.ZodNumber;
        viewSizes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            colSpan: z.ZodOptional<z.ZodNumber>;
            rowSpan: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            colSpan?: number | undefined;
            rowSpan?: number | undefined;
        }, {
            colSpan?: number | undefined;
            rowSpan?: number | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        columns: number;
        viewSizes?: Record<string, {
            colSpan?: number | undefined;
            rowSpan?: number | undefined;
        }> | undefined;
    }, {
        columns: number;
        viewSizes?: Record<string, {
            colSpan?: number | undefined;
            rowSpan?: number | undefined;
        }> | undefined;
    }>>;
    interactions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["crossfilter", "highlight"]>;
        field: z.ZodString;
        views: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "highlight" | "crossfilter";
        field: string;
        views?: string[] | undefined;
    }, {
        type: "highlight" | "crossfilter";
        field: string;
        views?: string[] | undefined;
    }>, "many">>;
    theme: z.ZodOptional<z.ZodEnum<["dark", "light"]>>;
}, "strip", z.ZodTypeAny, {
    table: string;
    views: {
        id: string;
        title: string;
        intent: string;
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
            having?: {
                field: string;
                op: "=" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "not_in" | "between" | "is_null" | "is_not_null";
                value?: any;
            }[] | undefined;
            orderBy?: {
                field: string;
                direction: "asc" | "desc";
            }[] | undefined;
            groupBy?: (string | {
                field: string;
                bucket: "day" | "week" | "month" | "quarter" | "year";
            })[] | undefined;
            limit?: number | undefined;
        };
        pattern?: string | undefined;
        config?: Record<string, any> | undefined;
        colorPreferences?: {
            highlight?: {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            } | undefined;
            colorField?: string | undefined;
            palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
        } | undefined;
    }[];
    sourceId: string;
    title?: string | undefined;
    description?: string | undefined;
    globalFilters?: {
        type: "select" | "multi-select" | "range" | "date-range";
        field: string;
        label?: string | undefined;
        values?: any[] | undefined;
        currentValue?: any;
    }[] | undefined;
    layout?: {
        columns: number;
        viewSizes?: Record<string, {
            colSpan?: number | undefined;
            rowSpan?: number | undefined;
        }> | undefined;
    } | undefined;
    interactions?: {
        type: "highlight" | "crossfilter";
        field: string;
        views?: string[] | undefined;
    }[] | undefined;
    theme?: "dark" | "light" | undefined;
}, {
    table: string;
    views: {
        id: string;
        title: string;
        intent: string;
        pattern?: string | undefined;
        config?: Record<string, any> | undefined;
        query?: unknown;
        colorPreferences?: {
            highlight?: {
                values: any[];
                color?: string | string[] | undefined;
                mutedColor?: string | undefined;
                mutedOpacity?: number | undefined;
            } | undefined;
            colorField?: string | undefined;
            palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
        } | undefined;
    }[];
    sourceId: string;
    title?: string | undefined;
    description?: string | undefined;
    globalFilters?: {
        type: "select" | "multi-select" | "range" | "date-range";
        field: string;
        label?: string | undefined;
        values?: any[] | undefined;
        currentValue?: any;
    }[] | undefined;
    layout?: {
        columns: number;
        viewSizes?: Record<string, {
            colSpan?: number | undefined;
            rowSpan?: number | undefined;
        }> | undefined;
    } | undefined;
    interactions?: {
        type: "highlight" | "crossfilter";
        field: string;
        views?: string[] | undefined;
    }[] | undefined;
    theme?: "dark" | "light" | undefined;
}>;
export declare const refineDashboardInputSchema: z.ZodObject<{
    currentSpec: z.ZodObject<{
        dashboard: z.ZodLiteral<true>;
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        sourceId: z.ZodString;
        table: z.ZodString;
        views: z.ZodArray<z.ZodAny, "many">;
        globalFilters: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        layout: z.ZodAny;
        interactions: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
        theme: z.ZodOptional<z.ZodEnum<["dark", "light"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        table: string;
        title: string;
        dashboard: true;
        views: any[];
        sourceId: string;
        description?: string | undefined;
        globalFilters?: any[] | undefined;
        layout?: any;
        interactions?: any[] | undefined;
        theme?: "dark" | "light" | undefined;
    }, {
        id: string;
        table: string;
        title: string;
        dashboard: true;
        views: any[];
        sourceId: string;
        description?: string | undefined;
        globalFilters?: any[] | undefined;
        layout?: any;
        interactions?: any[] | undefined;
        theme?: "dark" | "light" | undefined;
    }>;
    refinement: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refinement: string;
    currentSpec: {
        id: string;
        table: string;
        title: string;
        dashboard: true;
        views: any[];
        sourceId: string;
        description?: string | undefined;
        globalFilters?: any[] | undefined;
        layout?: any;
        interactions?: any[] | undefined;
        theme?: "dark" | "light" | undefined;
    };
}, {
    refinement: string;
    currentSpec: {
        id: string;
        table: string;
        title: string;
        dashboard: true;
        views: any[];
        sourceId: string;
        description?: string | undefined;
        globalFilters?: any[] | undefined;
        layout?: any;
        interactions?: any[] | undefined;
        theme?: "dark" | "light" | undefined;
    };
}>;
//# sourceMappingURL=dsl-schemas.d.ts.map