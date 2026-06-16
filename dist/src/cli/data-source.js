/**
 * Resolves a CLI "target" to queryable data.
 *
 * A target is either:
 *   1. an existing `.csv` file or a directory of CSVs → loaded into an
 *      ephemeral in-memory SQLite database (not registered anywhere), or
 *   2. the name/id of a source registered via `dolex sources add` → looked up
 *      in the persistent registry at `~/.dolex/sources.json` (shared with the
 *      MCP server).
 *
 * The `SourceManager` (and its `better-sqlite3` / `papaparse` deps) is imported
 * lazily so commands that never touch a CSV stay dependency-free.
 */
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, basename, join } from 'path';
import { dolexHome } from './paths.js';
export { dolexHome };
/**
 * Import the SourceManager module, turning a better-sqlite3 native-binding
 * load failure (e.g. a binary built for a different Node ABI) into an
 * actionable "rebuild it" message instead of a cryptic stack trace.
 */
async function loadManagerModule() {
    try {
        return await import('../connectors/manager.js');
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/better-sqlite3|bindings|NODE_MODULE_VERSION|did not self-register|invalid ELF/i.test(msg)) {
            throw new Error("Dolex's data engine (better-sqlite3, a native module) failed to load.\n" +
                '  Rebuild it for your Node version:  npm rebuild better-sqlite3\n' +
                `  (original error: ${msg})`);
        }
        throw e;
    }
}
export function registryPath() {
    return join(dolexHome(), 'sources.json');
}
/** Construct the persistent SourceManager backed by `~/.dolex/sources.json`. */
export async function persistentManager() {
    const { SourceManager } = await loadManagerModule();
    const { mkdirSync } = await import('fs');
    mkdirSync(dolexHome(), { recursive: true });
    return new SourceManager(registryPath());
}
function looksLikeFileTarget(target) {
    if (!existsSync(target))
        return false;
    try {
        const st = statSync(target);
        return st.isDirectory() || target.toLowerCase().endsWith('.csv');
    }
    catch {
        return false;
    }
}
/**
 * Open a target for querying. Throws an Error with a helpful message when the
 * target cannot be resolved or the chosen table does not exist.
 */
export async function openTarget(target, opts = {}) {
    const { SourceManager } = await loadManagerModule();
    let manager;
    let sourceId;
    let displayName;
    if (looksLikeFileTarget(target)) {
        manager = new SourceManager(); // ephemeral, no persistence
        const abs = resolve(target);
        displayName = basename(abs).replace(/\.csv$/i, '') || 'data';
        const added = await manager.add(displayName, { type: 'csv', path: abs });
        if (!added.ok || !added.entry) {
            throw new Error(added.error ?? `Could not load CSV: ${target}`);
        }
        sourceId = added.entry.id;
    }
    else {
        manager = await persistentManager();
        const entry = manager.get(target);
        if (!entry) {
            const available = manager.list().map((e) => `${e.name} (${e.id})`);
            const hint = available.length > 0
                ? `Registered sources: ${available.join(', ')}.`
                : 'No sources registered. Use `dolex sources add <name> <path>`, or pass a .csv file path.';
            throw new Error(`'${target}' is neither an existing .csv path nor a registered source. ${hint}`);
        }
        sourceId = entry.id;
        displayName = entry.name;
    }
    const schemaResult = await manager.getSchema(sourceId);
    if (!schemaResult.ok || !schemaResult.schema) {
        throw new Error(schemaResult.error ?? `Failed to read schema for ${displayName}`);
    }
    const schema = schemaResult.schema;
    const tables = schema.tables.map((t) => ({ name: t.name, columns: t.columns, rowCount: t.rowCount }));
    if (tables.length === 0) {
        throw new Error(`No tables found in ${displayName}.`);
    }
    let defaultTable = tables[0].name;
    if (opts.table) {
        const found = tables.find((t) => t.name === opts.table);
        if (!found) {
            throw new Error(`Table '${opts.table}' not found. Available: ${tables.map((t) => t.name).join(', ')}`);
        }
        defaultTable = found.name;
    }
    return {
        manager,
        sourceId,
        displayName,
        schema,
        tables,
        defaultTable,
        query: (sql, maxRows) => manager.querySql(sourceId, sql, maxRows),
        close: () => manager.disconnect(sourceId).then(() => undefined),
    };
}
/**
 * Read a JSON array of row objects from a file path or from stdin (when
 * `fromStdin` is true). Throws on malformed input.
 */
export async function readInlineRows(filePath, fromStdin) {
    let raw;
    if (fromStdin) {
        raw = await readStdin();
    }
    else if (filePath) {
        raw = readFileSync(resolve(filePath), 'utf-8');
    }
    else {
        throw new Error('No inline data source provided.');
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        throw new Error(`Could not parse JSON data: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error('Inline data must be a JSON array of row objects.');
    }
    if (parsed.length === 0) {
        throw new Error('Inline data array is empty.');
    }
    return parsed;
}
function readStdin() {
    return new Promise((resolvePromise, rejectPromise) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => resolvePromise(data));
        process.stdin.on('error', rejectPromise);
    });
}
