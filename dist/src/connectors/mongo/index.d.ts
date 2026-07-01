import type { DataConnector } from '../types.js';
/**
 * TOLERANT seam parse. Callers reliably produce correct aggregation STAGES but fumble the
 * hand-written JSON ENVELOPE, so accept, in order: the full {"collection","pipeline":[…]}; a BARE
 * pipeline array [<stages>] (wrapped with the primary collection); or an envelope missing its
 * trailing brace(s), repaired by balancing. Empty/garbage is rejected with an actionable message —
 * never silently "repaired" into a fake pipeline.
 */
export declare function parseSeam(query: string, defaultCollection?: string): {
    collection: string;
    pipeline: any[];
};
export declare const mongoConnector: DataConnector;
