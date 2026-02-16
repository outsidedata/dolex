/**
 * MCP Tool: report_bug
 * Generates a sanitized bug report for GitHub issues.
 * No data values, connection strings, or file paths leave the machine.
 * Field names anonymized by default (opt-in to include real names).
 */
import { z } from 'zod';
import type { SourceManager } from '../../connectors/manager.js';
export declare const bugReportInputSchema: z.ZodObject<{
    description: z.ZodString;
    specId: z.ZodOptional<z.ZodString>;
    includeFieldNames: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    description: string;
    specId?: string | undefined;
    includeFieldNames?: boolean | undefined;
}, {
    description: string;
    specId?: string | undefined;
    includeFieldNames?: boolean | undefined;
}>;
export declare function anonymizeColumns(columns: {
    name: string;
    type: string;
}[], include: boolean): {
    name: string;
    type: string;
}[];
export declare function sanitizeSpecConfig(config: Record<string, unknown>): Record<string, string>;
export declare function sanitizeError(error: string): string;
interface ReportDeps {
    sourceManager: SourceManager;
    serverStartTime: number;
}
export declare function handleReportBug(deps: ReportDeps): (args: z.infer<typeof bugReportInputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export {};
//# sourceMappingURL=bug-report.d.ts.map