/**
 * MCP Tool: query_data
 * Runs the constrained LLM pipeline to query a data source.
 * This is the local/private mode tool — for users who can't send data to cloud APIs.
 */
import { z } from 'zod';
export const queryDataInputSchema = z.object({
    query: z.string().describe('Natural language query — e.g., "top 10 players by home runs", "sales by region over time"'),
    sourceId: z.string().describe('ID of the data source to query (from list_sources)'),
    sessionId: z.string().optional().describe('Session ID for conversational follow-ups — reuse to maintain context'),
    model: z.string().optional().describe('Ollama model to use (default: gemma3:27b). Smaller models like gemma3:4b are faster but less accurate on complex queries.'),
});
/**
 * Creates the query_data tool handler.
 * Requires the query engine and source manager to be injected.
 */
export function handleQueryData(deps) {
    return async (args) => {
        const { queryEngine, sourceManager } = deps;
        // Get the registered source
        const entry = sourceManager.get(args.sourceId);
        if (!entry) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ error: `Data source "${args.sourceId}" not found. Use list_sources to see available sources.` }),
                    }],
                isError: true,
            };
        }
        try {
            // Connect lazily and get schema
            const connectResult = await sourceManager.connect(args.sourceId);
            if (!connectResult.ok || !connectResult.source) {
                throw new Error(connectResult.error ?? 'Failed to connect to source');
            }
            const schemaResult = await sourceManager.getSchema(args.sourceId);
            if (!schemaResult.ok || !schemaResult.schema) {
                throw new Error(schemaResult.error ?? 'Failed to get schema');
            }
            const result = await queryEngine.query({
                query: args.query,
                sourceId: args.sourceId,
                sessionId: args.sessionId,
                model: args.model,
            }, schemaResult.schema, connectResult.source);
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ error: error.message, query: args.query }),
                    }],
                isError: true,
            };
        }
    };
}
//# sourceMappingURL=query-data.js.map