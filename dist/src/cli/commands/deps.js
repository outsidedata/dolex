/**
 * `dolex deps` — report which optional capabilities are available in THIS environment, so a
 * human (or an AI agent driving Dolex) can see what's ready and how to enable the rest BEFORE
 * trying it. The sibling of `dolex check` (which audits DATA health); this audits ENVIRONMENT health.
 *
 * `--json` emits the shared capability report for an agent to reason on. Exit code is non-zero only
 * when a CORE dependency is missing (the base install is broken), like `dolex check`.
 */
import { parseArgs, bool } from '../args.js';
import * as o from '../output.js';
import { probeCapabilities } from '../../utils/capabilities.js';
export async function depsCommand(argv) {
    const args = parseArgs(argv, { booleans: ['json', 'help'], aliases: { h: 'help' } });
    if (bool(args, 'help')) {
        o.out('dolex deps — report which optional capabilities are available in this environment.');
        o.out('  --json   machine-readable report (for an AI agent to check readiness before acting)');
        return 0;
    }
    const cap = probeCapabilities();
    if (bool(args, 'json')) {
        o.out(JSON.stringify(cap, null, 2));
        return cap.coreOk ? 0 : 1;
    }
    o.heading('Data sources — what can I connect to here');
    o.out(o.table(['source', 'status'], [
        { source: 'CSV / SQLite', status: cap.sources.csv },
        { source: 'PostgreSQL', status: cap.sources.postgres },
        { source: 'MongoDB', status: cap.sources.mongodb },
    ]));
    o.out();
    o.heading('Optional features');
    o.out(o.table(['feature', 'installed', 'how to enable'], [
        ...cap.deps.map((d) => ({ feature: d.enables, installed: d.installed ? `✓ ${d.version ?? ''}`.trim() : '—', 'how to enable': d.install ?? '' })),
        { feature: cap.python.enables, installed: cap.python.available ? `✓ ${cap.python.version ?? ''}`.trim() : '—', 'how to enable': cap.python.install ?? '' },
    ]));
    if (!cap.coreOk) {
        o.out();
        o.fail('core engine (better-sqlite3) is missing — reinstall dolex.');
    }
    return cap.coreOk ? 0 : 1;
}
