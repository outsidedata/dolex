import type { z } from 'zod';
import type { cleanColumnSchema } from './clean-schemas.js';
export declare function handleCleanColumn(deps: {
    sourceManager: any;
}): (args: z.infer<typeof cleanColumnSchema>) => Promise<import("./shared.js").McpResponse>;
