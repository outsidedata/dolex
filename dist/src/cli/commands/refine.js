/**
 * `dolex refine` — tweak a previously-produced chart.
 *
 * Takes the spec's HASH (printed by visualize/refine) as an explicit argument,
 * loads it from `~/.dolex/specs/`, hydrates the in-memory store, reuses the
 * existing `handleRefine` logic, then persists the new spec under a new hash.
 *
 * The hash is the only handle — there is intentionally no shared "last" pointer,
 * which would cross streams between concurrent CLI processes (parallel agents).
 * Each refine returns a fresh hash; pass it back to chain further refinements.
 */
import { parseArgs, str, bool, num, list } from '../args.js';
import * as o from '../output.js';
import { loadSpec, persistSpec } from '../spec-disk.js';
import { emitChart } from '../emit.js';
import { handleRefine, refineInputSchema } from '../../mcp/tools/refine.js';
import { specStore } from '../../mcp/spec-store.js';
const BOOLEANS = ['flip', 'remove-table', 'open', 'stdout', 'json', 'help'];
const ALIASES = { o: 'out', h: 'help' };
const FILTER_OPS = new Set(['in', 'not_in', 'gt', 'gte', 'lt', 'lte', '=', '!=']);
export async function refineCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const input = args._[0];
    if (!input) {
        o.fail('Provide the spec hash from the visualize/refine output.');
        o.hint('Example:  dolex refine spec-1a2b3c4d --sort desc --palette blueRed');
        return 1;
    }
    // Accept the hash with or without the `spec-` prefix; the per-hash file is the
    // only state, so concurrent refines never interfere.
    const candidates = input.startsWith('spec-') ? [input] : [input, `spec-${input}`];
    let specId = '';
    let hydrated = null;
    for (const candidate of candidates) {
        if (!/^[A-Za-z0-9._-]+$/.test(candidate))
            continue;
        const h = loadSpec(candidate);
        if (h) {
            specId = candidate;
            hydrated = h;
            break;
        }
    }
    if (!hydrated) {
        o.fail(`Spec "${input}" not found in ~/.dolex/specs (wrong hash, or it aged out). Re-run visualize for a fresh hash.`);
        return 1;
    }
    let refineArgs;
    try {
        refineArgs = refineInputSchema.parse(buildRefineObject(specId, args));
    }
    catch (e) {
        o.fail(`Invalid refine options: ${e instanceof Error ? e.message : String(e)}`);
        return 1;
    }
    specStore.restore(specId, hydrated);
    const result = await handleRefine()(refineArgs);
    const body = JSON.parse(result.content[0].text);
    if (result.isError) {
        o.fail(body.error ?? 'Refine failed.');
        return 1;
    }
    const html = result.structuredContent?.html;
    const newStored = specStore.get(body.specId);
    if (newStored)
        persistSpec(body.specId, newStored);
    return emitChart({ args, body, html });
}
/** Translate CLI flags into the refineInputSchema shape (only set keys present). */
function buildRefineObject(specId, args) {
    const obj = { specId };
    const sort = str(args, 'sort');
    if (sort !== undefined)
        obj.sort = parseSort(sort);
    const limit = num(args, 'limit');
    if (limit !== undefined)
        obj.limit = limit;
    const filter = str(args, 'filter');
    if (filter !== undefined)
        obj.filter = parseFilters(filter);
    if (bool(args, 'flip'))
        obj.flip = true;
    for (const [flag, key] of [
        ['title', 'title'],
        ['subtitle', 'subtitle'],
        ['x-label', 'xLabel'],
        ['y-label', 'yLabel'],
        ['palette', 'palette'],
        ['color-field', 'colorField'],
        ['flow-color-by', 'flowColorBy'],
        ['format', 'format'],
        ['switch-pattern', 'switchPattern'],
        ['layout', 'layout'],
    ]) {
        const v = str(args, flag);
        if (v !== undefined)
            obj[key] = v;
    }
    const highlight = str(args, 'highlight');
    if (highlight !== undefined) {
        obj.highlight =
            highlight.toLowerCase() === 'none' || highlight === ''
                ? null
                : { values: highlight.split(',').map((s) => s.trim()).filter(Boolean) };
    }
    if (bool(args, 'remove-table'))
        obj.removeTable = true;
    const hide = list(args, 'hide-columns');
    if (hide !== undefined)
        obj.hideColumns = hide;
    return obj;
}
/**
 * `value:desc` | `region:asc` | `desc` | `none` → refine sort shape.
 * Field names keep their original case (SQL columns are case-sensitive);
 * the direction keyword is matched case-insensitively.
 */
export function parseSort(raw) {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'none' || lower === 'clear')
        return null;
    const dir = (s) => (s.trim().toLowerCase() === 'asc' ? 'asc' : 'desc');
    const [a, b] = trimmed.split(':').map((s) => s.trim());
    if (b)
        return { field: a, direction: dir(b) };
    if (a.toLowerCase() === 'asc' || a.toLowerCase() === 'desc')
        return { direction: dir(a) };
    return { field: a, direction: 'desc' };
}
/**
 * Parse one or more filter clauses separated by `;`.
 * Each clause is `field op v,v` (e.g. `region in North,South`, `price gt 1000`).
 * `clear` / `none` → empty array (clears all filters).
 */
export function parseFilters(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === 'clear' || trimmed === 'none' || trimmed === '')
        return [];
    const clauses = [];
    for (const clause of raw.split(';')) {
        const parts = clause.trim().split(/\s+/);
        if (parts.length < 3) {
            throw new Error(`filter clause "${clause.trim()}" must be: field op value[,value] (e.g. "region in North,South")`);
        }
        const [field, opRaw, ...rest] = parts;
        const op = opRaw.toLowerCase();
        if (!FILTER_OPS.has(op)) {
            throw new Error(`filter op "${opRaw}" must be one of: ${[...FILTER_OPS].join(', ')}`);
        }
        const values = rest
            .join(' ')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        clauses.push({ field, op, values });
    }
    return clauses;
}
function printHelp() {
    o.out(`${o.c.bold('dolex refine')} — tweak a previously-produced chart

${o.c.bold('USAGE')}
  dolex refine <hash> [options]      # <hash> is the specId printed by visualize/refine

${o.c.bold('OPERATIONS')}
  --sort <field:dir>      Sort by field (asc|desc); "value:desc", "desc", or "none"
  --limit <n>             Keep the top N rows
  --filter <expr>         "field op v,v" clauses joined by ';'; "clear" resets
                          ops: in, not_in, gt, gte, lt, lte, =, !=
  --flip                  Swap x/y axes (Cartesian charts)
  --palette <name>        Named palette
  --highlight <v,v>       Emphasize values; "none" clears
  --color-field <col>     Column that drives color
  --format <fmt>          percent | dollar | integer | decimal | compact
  --switch-pattern <id>   Change chart type
  --title, --subtitle, --x-label, --y-label
  --flow-color-by <s|t>   Color flows by source|target (sankey/alluvial/chord/funnel)
  --remove-table          Drop the companion data table
  --layout <rows|columns> Compound layout
  --hide-columns <a,b>    Hide table columns

${o.c.bold('OUTPUT')}  (same as visualize)
  -o/--out, --png, --open, --stdout, --json`);
}
