/**
 * Authoring prompt + constrained-output schema — the SHARED knowledge of HOW to
 * ask a model to write a Python clean(). The core never calls a model; a caller
 * (orchestrator's local model, or any agent) does the transport and passes the
 * resulting code in as a CleanAuthor.
 */
export interface AuthorRequest {
    column: string;
    issue: string;
    task: string;
    samples: string[];
    feedback?: string;
}
export type CleanAuthor = (req: AuthorRequest) => Promise<string>;
export declare const PY_SCHEMA: {
    type: string;
    properties: {
        code: {
            type: string;
        };
        note: {
            type: string;
        };
    };
    required: string[];
};
export declare function buildAuthorPrompt(req: AuthorRequest): {
    system: string;
    user: string;
};
