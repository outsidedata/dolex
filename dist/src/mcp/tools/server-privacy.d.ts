/**
 * Server privacy tools — inspect and clear cached data.
 *
 * server_status: Shows what data is currently held in memory.
 * clear_cache: Clears cached specs and query results.
 */
import { z } from 'zod';
import type { SourceManager } from '../../connectors/manager.js';
export declare const clearCacheInputSchema: z.ZodObject<{
    scope: z.ZodDefault<z.ZodEnum<["all", "specs", "results"]>>;
}, "strip", z.ZodTypeAny, {
    scope: "all" | "specs" | "results";
}, {
    scope?: "all" | "specs" | "results" | undefined;
}>;
interface PrivacyDeps {
    sourceManager: SourceManager;
    serverStartTime: number;
}
export declare function handleServerStatus(deps: PrivacyDeps): () => Promise<import("./shared.js").McpResponse>;
export declare function handleClearCache(deps: PrivacyDeps): ({ scope }: z.infer<typeof clearCacheInputSchema>) => Promise<{
    content: {
        type: "text";
        text: string;
    }[];
}>;
export {};
//# sourceMappingURL=server-privacy.d.ts.map