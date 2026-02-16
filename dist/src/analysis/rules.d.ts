import type { ClassifiedColumn, AnalysisStep } from './types.js';
export declare function capitalize(s: string): string;
export declare function pickTimeBucket(col: ClassifiedColumn): 'day' | 'week' | 'month' | 'quarter' | 'year';
export declare function generateCandidates(columns: ClassifiedColumn[], table: string): AnalysisStep[];
//# sourceMappingURL=rules.d.ts.map