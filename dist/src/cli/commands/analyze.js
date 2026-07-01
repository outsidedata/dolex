/**
 * `dolex analyze` — auto-generate an analysis plan: 4-6 prioritized steps, each
 * with a ready-to-run SQL query and a suggested chart pattern.
 */
import { parseArgs, str, num, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { buildAnalysisPlan } from '../../analysis/planner.js';
import { plannerDialectForSource, PlannerUnsupportedSourceError } from '../../analysis/rules.js';
import { classifyColumns } from '../../analysis/classify.js';
const BOOLEANS = ['json', 'help'];
const ALIASES = { h: 'help', table: 'from' };
/**
 * For a multi-table source with no explicit table, pick the most analyzable one
 * rather than the alphabetically-first (which is often a lookup/junction table
 * with no measures and yields an empty plan).
 */
function pickRichestTable(tables) {
    let best = tables[0];
    let bestScore = -Infinity;
    for (const t of tables) {
        const roles = classifyColumns(t.columns);
        const measures = roles.filter((r) => r.role === 'measure').length;
        const groupers = roles.filter((r) => r.role === 'dimension' || r.role === 'time' || r.role === 'hierarchy').length;
        const score = measures * 3 + groupers + t.columns.length * 0.001;
        if (score > bestScore) {
            bestScore = score;
            best = t;
        }
    }
    return best;
}
export async function analyzeCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const target = args._[0];
    if (!target) {
        o.fail('Usage: dolex analyze <csv|source>');
        return 1;
    }
    const explicitTable = str(args, 'from');
    const opened = await openTarget(target, { table: explicitTable });
    try {
        const autoPicked = !explicitTable && opened.tables.length > 1;
        const tableObj = autoPicked
            ? pickRichestTable(opened.tables)
            : opened.tables.find((t) => t.name === opened.defaultTable);
        let dialect;
        try {
            dialect = plannerDialectForSource(opened.schema.source?.type);
        }
        catch (err) {
            if (err instanceof PlannerUnsupportedSourceError) {
                o.fail(err.message);
                return 1;
            }
            throw err;
        }
        const plan = buildAnalysisPlan(tableObj.columns, tableObj.name, opened.displayName, num(args, 'max-steps') ?? 6, dialect);
        // No steps = nothing to analyze (only ids/text/empty columns). Fail loud
        // rather than print a success-looking empty plan.
        const noSteps = plan.steps.length === 0;
        if (bool(args, 'json')) {
            o.out(JSON.stringify({ ...plan, table: tableObj.name }, null, 2));
            return noSteps ? 1 : 0;
        }
        o.heading(`Analysis plan — ${opened.displayName}${opened.tables.length > 1 ? ` · table: ${tableObj.name}` : ''}`);
        o.hint(plan.summary);
        if (autoPicked) {
            const others = opened.tables.filter((t) => t.name !== tableObj.name).map((t) => t.name);
            o.hint(`(richest of ${opened.tables.length} tables — others: ${others.join(', ')}. Use --from <table> to pick another.)`);
        }
        if (noSteps) {
            o.fail(`No analyzable columns in "${tableObj.name}" — only identifiers/text/empty columns, nothing to plan.`);
            o.hint(opened.tables.length > 1
                ? 'Try --from <table> to analyze a different table.'
                : 'Check the data first with `dolex check`, or query it directly with `dolex query`.');
            return 1;
        }
        plan.steps.forEach((step, i) => {
            o.out('');
            o.out(`${o.c.bold(`${i + 1}. ${step.title}`)}  ${o.c.gray(`[${step.category}]`)}`);
            o.bullet(step.question);
            if (step.rationale)
                o.out(`     ${o.c.dim(step.rationale)}`);
            o.kv('chart', step.suggestedPatterns.join(', '));
            o.out(`     ${o.c.cyan(step.sql)}`);
        });
        o.out('');
        o.hint(`Run a step:  dolex visualize ${target} --sql "<sql>" -i "<question>" --pattern <id>`);
        return 0;
    }
    finally {
        await opened.close();
    }
}
function printHelp() {
    o.out(`${o.c.bold('dolex analyze')} — auto-generate an analysis plan

${o.c.bold('USAGE')}
  dolex analyze <csv|source> [options]

${o.c.bold('OPTIONS')}
  --max-steps <n>   Maximum steps to plan (1-10, default 6)
  --from <table>    Pick a table when the source has several
  --json            Emit the full plan as JSON`);
}
