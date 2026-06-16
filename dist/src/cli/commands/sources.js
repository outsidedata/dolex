/**
 * `dolex sources` — manage the persistent CSV registry at
 * `~/.dolex/sources.json` (shared with the MCP server's `load_csv`).
 */
import { resolve } from 'path';
import { parseArgs, bool } from '../args.js';
import * as o from '../output.js';
import { persistentManager } from '../data-source.js';
export async function sourcesCommand(argv) {
    const args = parseArgs(argv, { booleans: ['json', 'help'], aliases: { h: 'help' } });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const sub = args._[0] ?? 'list';
    const manager = await persistentManager();
    switch (sub) {
        case 'list': {
            const entries = manager.list();
            if (bool(args, 'json')) {
                o.out(JSON.stringify(entries, null, 2));
                return 0;
            }
            if (entries.length === 0) {
                o.hint('No registered sources. Add one:  dolex sources add <name> <path.csv>');
                return 0;
            }
            o.out(o.table(['name', 'id', 'type', 'path'], entries.map((e) => ({ name: e.name, id: e.id, type: e.type, path: e.config.path ?? '' }))));
            return 0;
        }
        case 'add': {
            const name = args._[1];
            const path = args._[2];
            if (!name || !path) {
                o.fail('Usage: dolex sources add <name> <path-to-csv-or-dir>');
                return 1;
            }
            const res = await manager.add(name, { type: 'csv', path: resolve(path) });
            if (!res.ok) {
                o.fail(res.error ?? 'Failed to add source.');
                return 1;
            }
            o.success(`Added "${name}" (${res.entry.id})`);
            o.hint(`Use it:  dolex visualize ${name} -i "…"   ·   dolex analyze ${name}`);
            return 0;
        }
        case 'remove':
        case 'rm': {
            const idOrName = args._[1];
            if (!idOrName) {
                o.fail('Usage: dolex sources remove <name|id>');
                return 1;
            }
            const res = await manager.remove(idOrName);
            if (!res.ok) {
                o.fail(res.error ?? 'Failed to remove source.');
                return 1;
            }
            o.success(`Removed "${idOrName}"`);
            return 0;
        }
        default:
            o.fail(`Unknown subcommand: ${sub}`);
            printHelp();
            return 1;
    }
}
function printHelp() {
    o.out(`${o.c.bold('dolex sources')} — manage the persistent CSV registry

${o.c.bold('USAGE')}
  dolex sources list
  dolex sources add <name> <path-to-csv-or-dir>
  dolex sources remove <name|id>

${o.c.dim('Stored in ~/.dolex/sources.json — shared with the MCP server.')}`);
}
