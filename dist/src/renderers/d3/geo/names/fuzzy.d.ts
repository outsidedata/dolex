export declare function levenshtein(a: string, b: string): number;
export interface FuzzySuggestion {
    value: string;
    suggestion: string;
    distance: number;
}
export declare function suggestMatch(input: string, candidates: string[], maxDistance?: number): FuzzySuggestion | undefined;
//# sourceMappingURL=fuzzy.d.ts.map