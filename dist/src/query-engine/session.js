/**
 * Session — Conversational follow-up context manager.
 *
 * NEW: Not in the POC. Stores recent queries + results per session.
 * When a new query references prior context ("now show that by year",
 * "drill into the Northeast"), it provides the previous selection
 * as context to the LLM.
 */
/**
 * Manages session state for conversational query follow-ups.
 *
 * Each session stores a bounded history of recent queries and selections.
 * When the LLM selector needs context for a follow-up query, the session
 * provides the most recent selection as reference.
 */
export class SessionManager {
    /** Map of session ID to ordered list of entries (most recent last). */
    sessions = new Map();
    /** Maximum number of entries to keep per session. */
    maxEntries;
    /** Maximum age of a session in milliseconds before it's purged. */
    maxAgeMs;
    constructor(options) {
        this.maxEntries = options?.maxEntries ?? 20;
        this.maxAgeMs = options?.maxAgeMs ?? 30 * 60 * 1000; // 30 minutes default
    }
    /**
     * Record a completed query and its selection in the session.
     */
    addEntry(sessionId, entry) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, []);
        }
        const entries = this.sessions.get(sessionId);
        entries.push({ ...entry, timestamp: Date.now() });
        // Trim to max entries
        if (entries.length > this.maxEntries) {
            entries.splice(0, entries.length - this.maxEntries);
        }
    }
    /**
     * Get the context from the most recent query in a session.
     *
     * Returns null if the session doesn't exist, is empty, or has expired.
     */
    getContext(sessionId) {
        const entries = this.sessions.get(sessionId);
        if (!entries || entries.length === 0)
            return null;
        const latest = entries[entries.length - 1];
        // Check if session has expired
        if (Date.now() - latest.timestamp > this.maxAgeMs) {
            this.sessions.delete(sessionId);
            return null;
        }
        return {
            previousQuery: latest.query,
            previousSelection: latest.selection,
        };
    }
    /**
     * Get full session history (for debugging or advanced context).
     */
    getHistory(sessionId) {
        return this.sessions.get(sessionId) ?? [];
    }
    /**
     * Clear a specific session.
     */
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
    }
    /**
     * Purge all expired sessions. Call periodically to prevent memory leaks.
     */
    purgeExpired() {
        const now = Date.now();
        let purged = 0;
        for (const [sessionId, entries] of this.sessions) {
            if (entries.length === 0 || now - entries[entries.length - 1].timestamp > this.maxAgeMs) {
                this.sessions.delete(sessionId);
                purged++;
            }
        }
        return purged;
    }
    /**
     * Detect if a query is likely a follow-up that references prior context.
     *
     * Looks for pronouns and relative references like:
     * - "that", "those", "the same", "it"
     * - "now show", "also show", "instead"
     * - "drill into", "break down", "by year", "by month"
     * - "but for", "but with", "and also"
     */
    static isFollowUp(query) {
        const lower = query.toLowerCase();
        const followUpPatterns = [
            /\bthat\b/,
            /\bthose\b/,
            /\bthe same\b/,
            /\bnow show\b/,
            /\balso show\b/,
            /\binstead\b/,
            /\bdrill into\b/,
            /\bbreak down\b/,
            /\bbut for\b/,
            /\bbut with\b/,
            /\band also\b/,
            /\bnow by\b/,
            /\bsame but\b/,
            /\bthis time\b/,
        ];
        return followUpPatterns.some(p => p.test(lower));
    }
}
//# sourceMappingURL=session.js.map