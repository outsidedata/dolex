import { z } from 'zod';
export declare const cleanColumnSchema: z.ZodObject<{
    sourceId: z.ZodString;
    table: z.ZodString;
    column: z.ZodString;
    code: z.ZodString;
    newColumn: z.ZodOptional<z.ZodString>;
    apply: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    table: string;
    code: string;
    column: string;
    sourceId: string;
    newColumn?: string | undefined;
    apply?: boolean | undefined;
}, {
    table: string;
    code: string;
    column: string;
    sourceId: string;
    newColumn?: string | undefined;
    apply?: boolean | undefined;
}>;
