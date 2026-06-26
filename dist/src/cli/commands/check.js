/**
 * `dolex check` — audit a dataset for bad data and analysis footguns before you
 * trust it. Read-only. Surfaces type traps, missing-value sentinels, dead/leaked
 * columns, duplicate rows, outliers, and quoting footguns, ranked by severity.
 *
 * Exits non-zero when HIGH-severity issues are found, so scripts/agents can gate.
 */
import { parseArgs, str, bool } from '../args.js';
import * as o from '../output.js';
import { openTarget } from '../data-source.js';
import { auditDataset } from '../../analysis/quality.js';
const BOOLEANS = ['json', 'help'];
const ALIASES = { h: 'help', table: 'from' };
export async function checkCommand(argv) {
    const args = parseArgs(argv, { booleans: BOOLEANS, aliases: ALIASES });
    if (bool(args, 'help')) {
        printHelp();
        return 0;
    }
    const target = args._[0];
    if (!target) {
        o.fail('Usage: dolex check <csv|source>');
        return 1;
    }
    const explicitTable = str(args, 'from');
    const opened = await openTarget(target, { table: explicitTable });
    try {
        const tablesToCheck = explicitTable
            ? opened.tables.filter((t) => t.name === opened.defaultTable)
            : opened.tables;
        const findings = await auditDataset(tablesToCheck, (sql) => opened.query(sql));
        if (bool(args, 'json')) {
            const counts = countBySeverity(findings);
            o.out(JSON.stringify({ tables: tablesToCheck.map((t) => t.name), counts, findings }, null, 2));
            return findings.some((f) => f.severity === 'high') ? 1 : 0;
        }
        return render(opened.displayName, tablesToCheck.length, findings);
    }
    finally {
        await opened.close();
    }
}
const ORDER = ['high', 'medium', 'low'];
const LABEL = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' };
function render(name, tableCount, findings) {
    o.heading(`Data check — ${name}${tableCount > 1 ? ` (${tableCount} tables)` : ''}`);
    if (findings.length === 0) {
        o.success('No data-quality issues or footguns found.');
        return 0;
    }
    const counts = countBySeverity(findings);
    o.hint(`${counts.high} high · ${counts.medium} medium · ${counts.low} low`);
    for (const sev of ORDER) {
        const group = findings.filter((f) => f.severity === sev);
        if (group.length === 0)
            continue;
        const color = sev === 'high' ? o.c.red : sev === 'medium' ? o.c.yellow : o.c.gray;
        o.heading(color(`${LABEL[sev]} (${group.length})`));
        for (const f of group) {
            const loc = f.column ? `${o.c.bold(f.column)} ` : '';
            const where = tableCount > 1 ? o.c.gray(`[${f.table}] `) : '';
            o.out(`  ${color('●')} ${where}${loc}${o.c.gray(`(${f.issue})`)}`);
            o.out(`      ${f.detail}`);
            if (f.suggestion)
                o.out(`      ${o.c.dim('→ ' + f.suggestion)}`);
        }
    }
    o.out('');
    if (counts.high > 0) {
        o.fail(`${counts.high} high-severity issue${counts.high === 1 ? '' : 's'} — review before trusting analysis on this data.`);
        return 1;
    }
    o.hint('No high-severity issues. Review the items above before deep analysis.');
    return 0;
}
function countBySeverity(findings) {
    return {
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        low: findings.filter((f) => f.severity === 'low').length,
    };
}
function printHelp() {
    o.out(`${o.c.bold('dolex check')} — audit data for bad data & analysis footguns

${o.c.bold('USAGE')}
  dolex check <csv|source> [--from <table>] [--json]

${o.c.dim('Flags type traps (numbers stored as text), missing-value sentinels, all-null/')}
${o.c.dim('constant/identical columns, duplicate rows, outliers, and quoting footguns.')}
${o.c.dim('Exits non-zero when HIGH-severity issues are found — gate scripts/agents on it.')}`);
}
