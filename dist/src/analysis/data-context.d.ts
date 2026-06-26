export interface DataContextMetric {
    name: string;
    /** Plain-English definition of what the metric means. */
    definition: string;
    /** The exact SQL expression/snippet that computes it. */
    sql: string;
    /** Optional caveats (edge cases, exclusions, known skew). */
    caveats?: string;
}
export interface DataContext {
    /** Dataset/table this context describes. */
    dataset: string;
    /** Term/alias → meaning, for entity disambiguation ("ARR" → annual recurring revenue). */
    entities?: {
        term: string;
        meaning: string;
    }[];
    /** Named metrics with English definition + canonical SQL. */
    metrics?: DataContextMetric[];
    /** Filters that should ALWAYS apply unless explicitly overridden (test data, deleted rows). */
    standardFilters?: {
        description: string;
        sql: string;
    }[];
    /** Per-column gotchas: timezone, units, NULL meaning, sentinel values. */
    columnNotes?: {
        column: string;
        note: string;
    }[];
    /** A few canonical question → SQL examples that ground the analyst. */
    queryExamples?: {
        question: string;
        sql: string;
    }[];
}
/** The sidecar path for a dataset CSV: `<dir>/<base>.context.json` (sits beside the
 *  `.dolex.json` transform manifest, same convention). */
export declare function dataContextPath(datasetPath: string): string;
/** Load a sidecar if present and well-formed. Best-effort: a missing or corrupt
 *  file yields null (the analyst simply runs without extra grounding). */
export declare function loadDataContext(datasetPath: string): DataContext | null;
/** Persist a sidecar atomically (temp + rename — same discipline as the registry). */
export declare function saveDataContext(datasetPath: string, ctx: DataContext): void;
/** Render a context into a compact prompt block. Only non-empty sections appear;
 *  returns '' for an empty/edge context so nothing is injected. */
export declare function renderDataContext(ctx: DataContext | null): string;
/** JSON schema for caller-driven authoring (constrained-output for a model). */
export declare const DATA_CONTEXT_SCHEMA: {
    type: string;
    properties: {
        dataset: {
            type: string;
        };
        entities: {
            type: string;
            items: {
                type: string;
                properties: {
                    term: {
                        type: string;
                    };
                    meaning: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        metrics: {
            type: string;
            items: {
                type: string;
                properties: {
                    name: {
                        type: string;
                    };
                    definition: {
                        type: string;
                    };
                    sql: {
                        type: string;
                    };
                    caveats: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        standardFilters: {
            type: string;
            items: {
                type: string;
                properties: {
                    description: {
                        type: string;
                    };
                    sql: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        columnNotes: {
            type: string;
            items: {
                type: string;
                properties: {
                    column: {
                        type: string;
                    };
                    note: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        queryExamples: {
            type: string;
            items: {
                type: string;
                properties: {
                    question: {
                        type: string;
                    };
                    sql: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
    };
    required: string[];
};
/** Authoring prompt for a caller's model: turn schema + sample rows + the quality
 *  audit into a DataContext. The core stays model-free; the caller runs this. */
export declare function buildContextAuthorPrompt(dataset: string, schemaText: string, sampleRows: string, auditNote: string): string;
