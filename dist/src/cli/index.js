#!/usr/bin/env node
/**
 * Dolex CLI — the primary entry point (`bin.dolex`).
 *
 * Dispatches subcommands. Command modules are dynamically imported so that
 * commands which never touch a CSV avoid loading the SQLite/papaparse optional
 * deps, and so `dolex mcp` is the only path that loads (and starts) the MCP
 * server — whose `main()` runs on import.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as o from './output.js';
function readVersion() {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
        const pkg = join(dir, 'package.json');
        if (existsSync(pkg)) {
            try {
                const parsed = JSON.parse(readFileSync(pkg, 'utf-8'));
                if (parsed.name === '@outsidedata/dolex' || parsed.name === 'dolex')
                    return parsed.version;
            }
            catch {
                /* keep walking up */
            }
        }
        const up = dirname(dir);
        if (up === dir)
            break;
        dir = up;
    }
    return undefined;
}
async function main() {
    const [cmd, ...rest] = process.argv.slice(2);
    switch (cmd) {
        case 'visualize':
        case 'viz':
            process.exit(await (await import('./commands/visualize.js')).visualizeCommand(rest));
        case 'refine':
            process.exit(await (await import('./commands/refine.js')).refineCommand(rest));
        case 'query':
        case 'q':
            process.exit(await (await import('./commands/query.js')).queryCommand(rest));
        case 'analyze':
            process.exit(await (await import('./commands/analyze.js')).analyzeCommand(rest));
        case 'describe':
        case 'desc':
            process.exit(await (await import('./commands/describe.js')).describeCommand(rest));
        case 'check':
        case 'audit':
            process.exit(await (await import('./commands/check.js')).checkCommand(rest));
        case 'transform':
            process.exit(await (await import('./commands/transform.js')).transformCommand(rest));
        case 'columns':
        case 'transforms':
            process.exit(await (await import('./commands/columns.js')).columnsCommand(rest));
        case 'drop':
            process.exit(await (await import('./commands/drop.js')).dropCommand(rest));
        case 'patterns':
        case 'pattern':
            process.exit(await (await import('./commands/patterns.js')).patternsCommand(rest));
        case 'sources':
        case 'source':
            process.exit(await (await import('./commands/sources.js')).sourcesCommand(rest));
        case 'mcp':
        case 'serve':
            // Starts the stdio server on import; do not exit — it owns the process.
            // The MCP SDK is an optional dependency: if it isn't installed, tell the
            // user exactly what to install instead of crashing with a cryptic error.
            try {
                await import('../mcp/index.js');
            }
            catch (e) {
                const { isModuleNotFound, missingDependencyMessage } = await import('../utils/optional-deps.js');
                if (isModuleNotFound(e) && /modelcontextprotocol/i.test(String(e))) {
                    o.fail(missingDependencyMessage('mcp'));
                    process.exit(1);
                }
                throw e;
            }
            return;
        case 'version':
        case '--version':
        case '-v':
            o.out(readVersion() ?? 'unknown');
            process.exit(0);
        case undefined:
        case 'help':
        case '--help':
        case '-h': {
            const { printMainHelp } = await import('./commands/help.js');
            printMainHelp(readVersion());
            process.exit(0);
        }
        default:
            o.fail(`Unknown command: ${cmd}`);
            o.hint('Run `dolex help` for usage.');
            process.exit(1);
    }
}
main().catch((e) => {
    o.fail(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
