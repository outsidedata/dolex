/**
 * MCP Tools: list_sources, add_source, remove_source, describe_source
 * Manage data source connections.
 */
import { z } from 'zod';
import { errorResponse, jsonResponse } from './shared.js';
const SANDBOX_PATH_PATTERNS = [
    /^\/mnt\/user-data\//,
    /^\/home\/claude\//,
    /^\/tmp\/uploads\//,
    /^\/mnt\/uploads\//,
];
export function isSandboxPath(filePath) {
    return SANDBOX_PATH_PATTERNS.some(p => p.test(filePath));
}
export const addSourceInputSchema = z.object({
    name: z.string().describe('Human-readable name for this data source'),
    type: z.enum(['csv', 'sqlite', 'postgres', 'mysql']).describe('Type of data source'),
    config: z.union([
        z.object({
            type: z.literal('csv'),
            path: z.string().describe('Path to CSV file or directory of CSV files'),
        }),
        z.object({
            type: z.literal('sqlite'),
            path: z.string().describe('Path to SQLite database file'),
        }),
        z.object({
            type: z.literal('postgres'),
            host: z.string(),
            port: z.number().default(5432),
            database: z.string(),
            user: z.string(),
            password: z.string(),
            ssl: z.boolean().optional(),
        }),
        z.object({
            type: z.literal('mysql'),
            host: z.string(),
            port: z.number().default(3306),
            database: z.string(),
            user: z.string(),
            password: z.string(),
        }),
    ]).describe('Connection configuration'),
    detail: z.enum(['compact', 'full']).default('full').describe('Schema detail level: "compact" returns just column names/types + row counts (saves tokens); "full" (default) includes stats, top values, and sample rows'),
});
export const removeSourceInputSchema = z.object({
    sourceId: z.string().describe('ID of the data source to remove'),
});
export const describeSourceInputSchema = z.object({
    sourceId: z.string().describe('Source ID from add_source'),
    table: z.string().optional().describe('Table name (optional — if omitted, returns all tables)'),
    detail: z.enum(['compact', 'full']).default('full').describe('Schema detail level: "compact" returns just column names/types + row counts; "full" (default) includes stats, top values, and sample rows'),
});
/** Build a table profile from schema table + connected source */
async function buildTableProfile(t, connectedSource, detail = 'full') {
    if (detail === 'compact') {
        return {
            name: t.name,
            rowCount: t.rowCount,
            columns: t.columns.map((c) => ({ name: c.name, type: c.type })),
        };
    }
    const sampleRows = connectedSource
        ? await connectedSource.getSampleRows(t.name, 5)
        : [];
    return {
        name: t.name,
        rowCount: t.rowCount,
        columns: t.columns.map((c) => ({
            name: c.name,
            type: c.type,
            nullCount: c.nullCount,
            uniqueCount: c.uniqueCount,
            ...(c.stats ? { stats: c.stats } : {}),
            ...(c.topValues ? { topValues: c.topValues } : {}),
            sample: c.sampleValues?.slice(0, 3),
        })),
        sampleRows,
    };
}
export function handleListSources(deps) {
    return async () => jsonResponse(deps.sourceManager.list());
}
export function handleAddSource(deps) {
    return async (args) => {
        if ((args.config.type === 'csv' || args.config.type === 'sqlite') && 'path' in args.config) {
            if (isSandboxPath(args.config.path)) {
                return errorResponse('This path looks like a cloud sandbox path, not a local filesystem path. '
                    + 'Dolex runs on the user\'s machine and can access any local file — but not cloud sandbox uploads. '
                    + 'Ask the user for the real local path (e.g. /Users/name/Downloads/data.csv).');
            }
        }
        let entry;
        let reconnected = false;
        const existing = deps.sourceManager.get(args.name);
        if (existing) {
            entry = existing;
            reconnected = true;
        }
        else {
            let addResult;
            try {
                addResult = await deps.sourceManager.add(args.name, args.config);
            }
            catch (err) {
                if (err.code === 'ENOENT') {
                    return errorResponse(`File not found: ${args.config.path}. `
                        + 'Ask the user to double-check the path exists on their machine.');
                }
                return errorResponse(err.message);
            }
            if (!addResult.ok || !addResult.entry) {
                return errorResponse(addResult.error ?? 'Failed to add source');
            }
            entry = addResult.entry;
        }
        const schemaResult = await deps.sourceManager.getSchema(entry.id);
        const schema = schemaResult.ok ? schemaResult.schema : null;
        const connResult = await deps.sourceManager.connect(entry.id);
        const connectedSource = connResult.ok ? connResult.source : null;
        const tables = await Promise.all((schema?.tables ?? []).map((t) => buildTableProfile(t, connectedSource, args.detail)));
        const tableCount = schema?.tables.length ?? 0;
        const verb = reconnected ? 'Reconnected to' : 'Connected to';
        return jsonResponse({
            sourceId: entry.id,
            name: entry.name,
            type: entry.type,
            tables,
            message: `${verb} "${args.name}" — ${tableCount} tables found`,
        });
    };
}
export function handleRemoveSource(deps) {
    return async (args) => {
        let removeResult;
        try {
            removeResult = await deps.sourceManager.remove(args.sourceId);
        }
        catch (err) {
            return errorResponse(err.message);
        }
        if (!removeResult.ok) {
            return errorResponse(removeResult.error ?? 'Failed to remove source');
        }
        return jsonResponse({ message: `Source "${args.sourceId}" removed` });
    };
}
export function handleDescribeSource(deps) {
    return async (args) => {
        const schemaResult = await deps.sourceManager.getSchema(args.sourceId);
        if (!schemaResult.ok || !schemaResult.schema) {
            return errorResponse(schemaResult.error ?? `Source not found: ${args.sourceId}`);
        }
        const connResult = await deps.sourceManager.connect(args.sourceId);
        const connectedSource = connResult.ok ? connResult.source : null;
        let tables = schemaResult.schema.tables;
        if (args.table) {
            tables = tables.filter((t) => t.name === args.table);
            if (tables.length === 0) {
                return errorResponse(`Table "${args.table}" not found. Available: ${schemaResult.schema.tables.map((t) => t.name).join(', ')}`);
            }
        }
        const profiles = await Promise.all(tables.map((t) => buildTableProfile(t, connectedSource, args.detail)));
        return jsonResponse(args.table ? profiles[0] : profiles);
    };
}
//# sourceMappingURL=sources.js.map