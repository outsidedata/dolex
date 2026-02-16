/**
 * Session — Conversational follow-up context manager.
 *
 * NEW: Not in the POC. Stores recent queries + results per session.
 * When a new query references prior context ("now show that by year",
 * "drill into the Northeast"), it provides the previous selection
 * as context to the LLM.
 */
import type { LLMColumnSelection } from '../types.js';
export interface SessionEntry {
    query: string;
    selection: LLMColumnSelection;
    chartTypeHint: string;
    timestamp: number;
}
export interface SessionContext {
    previousQuery: string;
    previousSelection: LLMColumnSelection;
}
/**
 * Manages session state for conversational query follow-ups.
 *
 * Each session stores a bounded history of recent queries and selections.
 * When the LLM selector needs context for a follow-up query, the session
 * provides the most recent selection as reference.
 */
export declare class SessionManager {
    /** Map of session ID to ordered list of entries (most recent last). */
    private sessions;
    /** Maximum number of entries to keep per session. */
    private maxEntries;
    /** Maximum age of a session in milliseconds before it's purged. */
    private maxAgeMs;
    constructor(options?: {
        maxEntries?: number;
        maxAgeMs?: number;
    });
    /**
     * Record a completed query and its selection in the session.
     */
    addEntry(sessionId: string, entry: Omit<SessionEntry, 'timestamp'>): void;
    /**
     * Get the context from the most recent query in a session.
     *
     * Returns null if the session doesn't exist, is empty, or has expired.
     */
    getContext(sessionId: string): SessionContext | null;
    /**
     * Get full session history (for debugging or advanced context).
     */
    getHistory(sessionId: string): SessionEntry[];
    /**
     * Clear a specific session.
     */
    clearSession(sessionId: string): void;
    /**
     * Purge all expired sessions. Call periodically to prevent memory leaks.
     */
    purgeExpired(): number;
    /**
     * Detect if a query is likely a follow-up that references prior context.
     *
     * Looks for pronouns and relative references like:
     * - "that", "those", "the same", "it"
     * - "now show", "also show", "instead"
     * - "drill into", "break down", "by year", "by month"
     * - "but for", "but with", "and also"
     */
    static isFollowUp(query: string): boolean;
}
//# sourceMappingURL=session.d.ts.map