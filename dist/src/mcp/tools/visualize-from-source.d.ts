/**
 * MCP Tool: visualize_from_source
 * Takes a data source + DSL query + intent and returns visualization
 * recommendations from the handcrafted pattern library.
 *
 * For inline data, use the `visualize` tool instead.
 */
import { z } from 'zod';
import type { VisualizeInput, VisualizeOutput } from '../../types.js';
export declare const visualizeFromSourceInputSchema: z.ZodObject<{
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
    intent: z.ZodString;
    columns: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["numeric", "categorical", "date", "id", "text"]>;
        sampleValues: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        uniqueCount: z.ZodOptional<z.ZodNumber>;
        nullCount: z.ZodOptional<z.ZodNumber>;
        totalCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "numeric" | "categorical" | "date" | "id" | "text";
        name: string;
        sampleValues?: string[] | undefined;
        uniqueCount?: number | undefined;
        nullCount?: number | undefined;
        totalCount?: number | undefined;
    }, {
        type: "numeric" | "categorical" | "date" | "id" | "text";
        name: string;
        sampleValues?: string[] | undefined;
        uniqueCount?: number | undefined;
        nullCount?: number | undefined;
        totalCount?: number | undefined;
    }>, "many">>;
    dataShapeHints: z.ZodOptional<z.ZodObject<{
        rowCount: z.ZodOptional<z.ZodNumber>;
        categoryCount: z.ZodOptional<z.ZodNumber>;
        seriesCount: z.ZodOptional<z.ZodNumber>;
        numericColumnCount: z.ZodOptional<z.ZodNumber>;
        categoricalColumnCount: z.ZodOptional<z.ZodNumber>;
        dateColumnCount: z.ZodOptional<z.ZodNumber>;
        hasTimeSeries: z.ZodOptional<z.ZodBoolean>;
        hasHierarchy: z.ZodOptional<z.ZodBoolean>;
        hasNegativeValues: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        dateColumnCount?: number | undefined;
        categoricalColumnCount?: number | undefined;
        rowCount?: number | undefined;
        categoryCount?: number | undefined;
        seriesCount?: number | undefined;
        numericColumnCount?: number | undefined;
        hasTimeSeries?: boolean | undefined;
        hasHierarchy?: boolean | undefined;
        hasNegativeValues?: boolean | undefined;
    }, {
        dateColumnCount?: number | undefined;
        categoricalColumnCount?: number | undefined;
        rowCount?: number | undefined;
        categoryCount?: number | undefined;
        seriesCount?: number | undefined;
        numericColumnCount?: number | undefined;
        hasTimeSeries?: boolean | undefined;
        hasHierarchy?: boolean | undefined;
        hasNegativeValues?: boolean | undefined;
    }>>;
    pattern: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    subtitle: z.ZodOptional<z.ZodString>;
    includeDataTable: z.ZodOptional<z.ZodBoolean>;
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
    maxAlternativeChartTypes: z.ZodOptional<z.ZodNumber>;
    geoLevel: z.ZodOptional<z.ZodEnum<["country", "subdivision"]>>;
    geoRegion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    table: string;
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
    pattern?: string | undefined;
    title?: string | undefined;
    columns?: {
        type: "numeric" | "categorical" | "date" | "id" | "text";
        name: string;
        sampleValues?: string[] | undefined;
        uniqueCount?: number | undefined;
        nullCount?: number | undefined;
        totalCount?: number | undefined;
    }[] | undefined;
    geoRegion?: string | undefined;
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
    dataShapeHints?: {
        dateColumnCount?: number | undefined;
        categoricalColumnCount?: number | undefined;
        rowCount?: number | undefined;
        categoryCount?: number | undefined;
        seriesCount?: number | undefined;
        numericColumnCount?: number | undefined;
        hasTimeSeries?: boolean | undefined;
        hasHierarchy?: boolean | undefined;
        hasNegativeValues?: boolean | undefined;
    } | undefined;
    subtitle?: string | undefined;
    includeDataTable?: boolean | undefined;
    maxAlternativeChartTypes?: number | undefined;
    geoLevel?: "country" | "subdivision" | undefined;
}, {
    table: string;
    intent: string;
    sourceId: string;
    pattern?: string | undefined;
    title?: string | undefined;
    columns?: {
        type: "numeric" | "categorical" | "date" | "id" | "text";
        name: string;
        sampleValues?: string[] | undefined;
        uniqueCount?: number | undefined;
        nullCount?: number | undefined;
        totalCount?: number | undefined;
    }[] | undefined;
    geoRegion?: string | undefined;
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
    dataShapeHints?: {
        dateColumnCount?: number | undefined;
        categoricalColumnCount?: number | undefined;
        rowCount?: number | undefined;
        categoryCount?: number | undefined;
        seriesCount?: number | undefined;
        numericColumnCount?: number | undefined;
        hasTimeSeries?: boolean | undefined;
        hasHierarchy?: boolean | undefined;
        hasNegativeValues?: boolean | undefined;
    } | undefined;
    subtitle?: string | undefined;
    includeDataTable?: boolean | undefined;
    maxAlternativeChartTypes?: number | undefined;
    geoLevel?: "country" | "subdivision" | undefined;
    query?: unknown;
}>;
export declare function handleVisualizeFromSource(selectPatterns: (input: VisualizeInput) => VisualizeOutput, deps: {
    sourceManager: any;
}): (args: z.infer<typeof visualizeFromSourceInputSchema>) => Promise<{
    structuredContent?: {
        html: string;
    } | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=visualize-from-source.d.ts.map