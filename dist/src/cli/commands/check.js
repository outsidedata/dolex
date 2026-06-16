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
import { auditColumns } from '../../analysis/quality.js';
const BOOLEANS = ['json', 'help'];
const ALIASES = { h: 'help', table: 'from' };
const MAX_DUP_ROWS_SCAN = 500_000; // skip the full-table distinct scan above this
const MAX_IDENTICAL_PAIRS = 80; // bound the pairwise identical-column comparison
function esc(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
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
        const findings = [];
        for (const t of tablesToCheck) {
            findings.push(...auditColumns(t.name, t.columns, t.rowCount));
            findings.push(...(await tableLevelChecks(opened, t)));
        }
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
async function tableLevelChecks(opened, t) {
    const out = [];
    // Duplicate rows (skip very large tables to bound cost).
    if (t.rowCount > 0 && t.rowCount <= MAX_DUP_ROWS_SCAN) {
        const res = await opened.query(`SELECT (SELECT COUNT(*) FROM ${esc(t.name)}) - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM ${esc(t.name)})) AS dups`);
        const dups = res.ok && res.rows && res.rows[0] ? Number(res.rows[0].dups) : NaN;
        if (!res.ok || !Number.isFinite(dups)) {
            // A failed check must be loud — never report clean when we didn't actually look.
            out.push({
                severity: 'high',
                table: t.name,
                issue: 'check-incomplete',
                detail: `Duplicate-row check could not complete${res.ok ? '' : `: ${res.error}`}.`,
                suggestion: 'The audit is incomplete — do not trust a clean result; re-run.',
            });
        }
        else if (dups > 0) {
            out.push({
                severity: 'medium',
                table: t.name,
                issue: 'duplicate-rows',
                detail: `${dups} fully-duplicate row${dups === 1 ? '' : 's'} (${pct(dups, t.rowCount)} of the table).`,
                suggestion: 'Verify these are real repeats and not an accidental double-load or join fan-out.',
            });
        }
    }
    // Identical (redundant/leaked) columns: only compare columns that already share
    // type + cardinality + null count, so the pairwise scan stays cheap.
    const groups = new Map();
    for (const c of t.columns) {
        const key = `${c.type}|${c.uniqueCount}|${c.nullCount}`;
        const arr = groups.get(key);
        if (arr)
            arr.push(c);
        else
            groups.set(key, [c]);
    }
    let comparisons = 0;
    for (const group of groups.values()) {
        if (group.length < 2)
            continue;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                if (comparisons++ >= MAX_IDENTICAL_PAIRS)
                    break;
                const a = group[i].name;
                const b = group[j].name;
                const res = await opened.query(`SELECT COUNT(*) AS diff FROM ${esc(t.name)} WHERE ${esc(a)} IS NOT ${esc(b)}`);
                const diff = res.ok && res.rows && res.rows[0] ? Number(res.rows[0].diff) : NaN;
                if (!res.ok || !Number.isFinite(diff)) {
                    // Don't silently treat a failed comparison as "columns differ".
                    out.push({
                        severity: 'high',
                        table: t.name,
                        column: `${a} vs ${b}`,
                        issue: 'check-incomplete',
                        detail: `Could not compare columns "${a}" and "${b}"${res.ok ? '' : `: ${res.error}`}.`,
                        suggestion: 'The audit is incomplete — do not trust a clean result; re-run.',
                    });
                }
                else if (diff === 0) {
                    out.push({
                        severity: 'high',
                        table: t.name,
                        column: `${a} = ${b}`,
                        issue: 'identical-columns',
                        detail: `Columns "${a}" and "${b}" are identical on every row.`,
                        suggestion: 'Redundant or leaked feature — a model/analysis "predicting" one just reads the other. Drop one.',
                    });
                }
            }
        }
    }
    return out;
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
function pct(n, total) {
    return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}
function printHelp() {
    o.out(`${o.c.bold('dolex check')} — audit data for bad data & analysis footguns

${o.c.bold('USAGE')}
  dolex check <csv|source> [--from <table>] [--json]

${o.c.dim('Flags type traps (numbers stored as text), missing-value sentinels, all-null/')}
${o.c.dim('constant/identical columns, duplicate rows, outliers, and quoting footguns.')}
${o.c.dim('Exits non-zero when HIGH-severity issues are found — gate scripts/agents on it.')}`);
}
