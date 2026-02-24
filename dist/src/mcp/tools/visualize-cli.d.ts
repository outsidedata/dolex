/**
 * MCP Tool: visualize_cli_only
 *
 * FOR CLAUDE CODE / CLI USE ONLY. DO NOT USE IN CLAUDE DESKTOP.
 *
 * Same as visualize but:
 * - NEVER returns HTML in response
 * - Writes HTML directly to disk via writeTo parameter
 * - Returns only specId and metadata
 */
import { z } from 'zod';
import type { VisualizeInput, VisualizeOutput } from '../../types.js';
export declare const visualizeCliInputSchema: z.ZodObject<{
    data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodAny>, "many">>;
    resultId: z.ZodOptional<z.ZodString>;
    sourceId: z.ZodOptional<z.ZodString>;
    sql: z.ZodOptional<z.ZodString>;
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
    writeTo: z.ZodString;
}, "strip", z.ZodTypeAny, {
    intent: string;
    writeTo: string;
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
    sourceId?: string | undefined;
    sql?: string | undefined;
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
    writeTo: string;
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
    sourceId?: string | undefined;
    sql?: string | undefined;
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
export declare function handleVisualizeCli(selectPatterns: (input: VisualizeInput) => VisualizeOutput, deps?: {
    sourceManager?: any;
}): (args: z.infer<typeof visualizeCliInputSchema>) => Promise<import("./shared.js").McpResponse>;
//# sourceMappingURL=visualize-cli.d.ts.map