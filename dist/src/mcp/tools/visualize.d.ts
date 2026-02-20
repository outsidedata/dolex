/**
 * MCP Tool: visualize
 * Takes inline data + intent and returns visualization recommendations
 * from the handcrafted pattern library.
 *
 * For source-based data (sourceId + table + query), use visualize_data.
 *
 * Returns compact text content (specId + metadata, no data) while
 * structuredContent still gets the full pre-rendered chart HTML.
 */
import { z } from 'zod';
import type { VisualizeInput, VisualizeOutput } from '../../types.js';
import type { OperationMeta } from './operation-log.js';
export declare const columnsSchema: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
export declare const dataShapeHintsSchema: z.ZodOptional<z.ZodObject<{
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
export declare const visualizeInputSchema: z.ZodObject<{
    data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>, "many">>;
    resultId: z.ZodOptional<z.ZodString>;
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
    palette: z.ZodOptional<z.ZodEnum<["categorical", "blue", "green", "purple", "warm", "blueRed", "greenPurple", "tealOrange", "redGreen", "traffic-light", "profit-loss", "temperature"]>>;
    highlight: z.ZodOptional<z.ZodObject<{
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
    }>>;
    colorField: z.ZodOptional<z.ZodString>;
    maxAlternativeChartTypes: z.ZodOptional<z.ZodNumber>;
    geoLevel: z.ZodOptional<z.ZodEnum<["country", "subdivision"]>>;
    geoRegion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    intent: string;
    columns?: {
        type: "numeric" | "categorical" | "date" | "id" | "text";
        name: string;
        sampleValues?: string[] | undefined;
        uniqueCount?: number | undefined;
        nullCount?: number | undefined;
        totalCount?: number | undefined;
    }[] | undefined;
    data?: Record<string, any>[] | undefined;
    pattern?: string | undefined;
    title?: string | undefined;
    highlight?: {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    } | undefined;
    colorField?: string | undefined;
    palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    geoRegion?: string | undefined;
    resultId?: string | undefined;
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
    intent: string;
    columns?: {
        type: "numeric" | "categorical" | "date" | "id" | "text";
        name: string;
        sampleValues?: string[] | undefined;
        uniqueCount?: number | undefined;
        nullCount?: number | undefined;
        totalCount?: number | undefined;
    }[] | undefined;
    data?: Record<string, any>[] | undefined;
    pattern?: string | undefined;
    title?: string | undefined;
    highlight?: {
        values: (string | number)[];
        color?: string | string[] | undefined;
        mutedColor?: string | undefined;
        mutedOpacity?: number | undefined;
    } | undefined;
    colorField?: string | undefined;
    palette?: "categorical" | "blue" | "green" | "purple" | "warm" | "blueRed" | "greenPurple" | "tealOrange" | "redGreen" | "traffic-light" | "profit-loss" | "temperature" | undefined;
    geoRegion?: string | undefined;
    resultId?: string | undefined;
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
}>;
/**
 * Shared core logic for both visualize and visualize_data.
 * Takes resolved data + args and returns the MCP response.
 */
export declare function handleVisualizeCore(selectPatterns: (input: VisualizeInput) => VisualizeOutput, toolName?: string): (data: Record<string, any>[], args: {
    intent: string;
    columns?: z.infer<typeof columnsSchema>;
    dataShapeHints?: z.infer<typeof dataShapeHintsSchema>;
    pattern?: string;
    title?: string;
    subtitle?: string;
    includeDataTable?: boolean;
    palette?: string;
    highlight?: {
        values: any[];
        color?: string | string[];
        mutedColor?: string;
        mutedOpacity?: number;
    };
    colorField?: string;
    maxAlternativeChartTypes?: number;
    geoLevel?: "country" | "subdivision";
    geoRegion?: string;
}, queryMeta?: {
    truncated?: boolean;
    totalSourceRows?: number;
}, extraMeta?: Partial<OperationMeta>) => {
    structuredContent?: {
        html: string;
    } | undefined;
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function handleVisualize(selectPatterns: (input: VisualizeInput) => VisualizeOutput): (args: z.infer<typeof visualizeInputSchema>) => Promise<{
    structuredContent?: {
        html: string;
    } | undefined;
    content: {
        type: "text";
        text: string;
    }[];
}>;
//# sourceMappingURL=visualize.d.ts.map