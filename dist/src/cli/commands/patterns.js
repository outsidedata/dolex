/**
 * `dolex patterns` — list the 43 chart patterns grouped by category, or show
 * one pattern in detail.
 */
import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { registry } from '../../patterns/registry.js';
const BOOLEANS = ['json', 'help'];
const ALIASES = { h: 'help', c: 'category' };
export async function patternsCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const id = args._[0];
    // Detail view for a single pattern.
    if (id) {
        const p = registry.get(id);
        if (!p) {
            o.fail(`No pattern "${id}".`);
            o.hint('Run `dolex patterns` to see all ids.');
            return 1;
        }
        if (bool(args, 'json')) {
            o.out(JSON.stringify(p, (k, v) => (k === 'selectionRules' || k === 'generateSpec' ? undefined : v), 2));
            return 0;
        }
        o.heading(`${p.id}  ${o.c.dim('— ' + p.name)}`);
        o.kv('category', p.category);
        o.out(`  ${p.description}`);
        if (p.bestFor)
            o.kv('best for', p.bestFor);
        if (p.notFor)
            o.kv('not for', p.notFor);
        const req = p.dataRequirements ?? {};
        const reqParts = [];
        if (req.minRows != null)
            reqParts.push(`≥${req.minRows} rows`);
        if (req.maxRows != null)
            reqParts.push(`≤${req.maxRows} rows`);
        if (req.requiresTimeSeries)
            reqParts.push('time series');
        if (req.requiresHierarchy)
            reqParts.push('hierarchy');
        if (reqParts.length)
            o.kv('requires', reqParts.join(', '));
        o.out('');
        o.hint(`Use it:  dolex visualize <data> --pattern ${p.id} -i "<intent>"`);
        return 0;
    }
    const all = registry.getAll();
    if (bool(args, 'json')) {
        o.out(JSON.stringify(all.map((p) => ({ id: p.id, name: p.name, category: p.category, bestFor: p.bestFor })), null, 2));
        return 0;
    }
    const filter = str(args, 'category');
    const categories = registry.getCategories();
    o.out(o.c.dim(`${all.length} patterns across ${categories.length} categories`));
    for (const { category, patterns } of categories) {
        if (filter && category !== filter)
            continue;
        o.heading(category);
        for (const pid of patterns) {
            const p = registry.get(pid);
            if (!p)
                continue;
            o.out(`  ${o.c.cyan(p.id.padEnd(20))} ${o.c.dim(truncate(p.bestFor || p.description, 56))}`);
        }
    }
    return 0;
}
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function printHelp() {
    o.out(`${o.c.bold('dolex patterns')} — browse the 43 chart patterns

${o.c.bold('USAGE')}
  dolex patterns                 List all, grouped by category
  dolex patterns <id>            Show one pattern in detail
  dolex patterns -c <category>   Filter to a category

${o.c.bold('OPTIONS')}
  -c, --category <name>   comparison | distribution | composition | time | relationship | flow | geo
  --json                  Emit pattern metadata as JSON`);
}
