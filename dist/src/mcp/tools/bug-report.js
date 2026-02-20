/**
 * MCP Tool: report_bug
 * Generates a sanitized bug report for GitHub issues.
 * No data values, connection strings, or file paths leave the machine.
 * Field names anonymized by default (opt-in to include real names).
 */
import { z } from 'zod';
import { createRequire } from 'node:module';
import { platform, version as nodeVersion } from 'node:process';
import { specStore } from '../spec-store.js';
import { resultCacheStats } from './result-cache.js';
import { operationLog } from './operation-log.js';
import { formatUptime } from './shared.js';
const require = createRequire(import.meta.url);
let dolexVersion;
try {
    dolexVersion = require('../../../../package.json').version;
}
catch {
    dolexVersion = require('../../../package.json').version;
}
export const bugReportInputSchema = z.object({
    description: z.string().describe('What went wrong — describe the issue'),
    specId: z.string().optional().describe('Spec ID from a recent visualize/refine call to include context'),
    includeFieldNames: z.boolean().optional().describe('Include real field names in the report (default: false — fields anonymized as col_0, col_1)'),
});
export function anonymizeColumns(columns, include) {
    return columns.map((c, i) => ({
        name: include ? c.name : `col_${i}`,
        type: c.type,
    }));
}
export function sanitizeSpecConfig(config) {
    const safe = {};
    for (const [key, val] of Object.entries(config)) {
        if (key.startsWith('_'))
            continue;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            safe[key] = String(val);
        }
        else if (val == null) {
            safe[key] = 'null';
        }
        else {
            safe[key] = typeof val;
        }
    }
    return safe;
}
export function sanitizeError(error) {
    return error
        .replace(/\/[\w/.~-]+/g, '<path>')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi, '<email>');
}
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}
function buildOperationsTable(entries) {
    if (entries.length === 0)
        return '_No recent operations._';
    const rows = entries.map(e => {
        const status = e.success ? 'ok' : 'error';
        const pattern = e.meta.pattern || '-';
        const shape = e.meta.dataShape
            ? `${e.meta.dataShape.rowCount}r x ${e.meta.dataShape.columnCount}c`
            : '-';
        return `| ${e.toolName} | ${status} | ${formatDuration(e.durationMs)} | ${pattern} | ${shape} |`;
    });
    return [
        '| Tool | Status | Duration | Pattern | Shape |',
        '|------|--------|----------|---------|-------|',
        ...rows,
    ].join('\n');
}
export function handleReportBug(deps) {
    return async (args) => {
        const includeFieldNames = args.includeFieldNames ?? false;
        const sections = [];
        sections.push(`## Description\n\n${args.description}`);
        sections.push([
            '## Environment',
            '',
            `- **Dolex**: ${dolexVersion}`,
            `- **Node.js**: ${nodeVersion}`,
            `- **Platform**: ${platform}`,
        ].join('\n'));
        if (args.specId) {
            const stored = specStore.get(args.specId);
            if (stored) {
                const spec = stored.spec;
                const columns = anonymizeColumns(stored.columns.map(c => ({ name: c.name, type: c.type })), includeFieldNames);
                const contextLines = [
                    '## Visualization Context',
                    '',
                    `- **Pattern**: ${spec.pattern}`,
                    `- **Data shape**: ${spec.data?.length ?? '?'} rows x ${columns.length} columns`,
                    `- **Columns**: ${columns.map(c => `${c.name} (${c.type})`).join(', ')}`,
                ];
                if (spec.encoding) {
                    const fieldNameMap = new Map();
                    if (!includeFieldNames) {
                        stored.columns.forEach((c, i) => fieldNameMap.set(c.name, `col_${i}`));
                    }
                    const encodingFields = [];
                    for (const [channel, enc] of Object.entries(spec.encoding)) {
                        const field = enc?.field;
                        if (field) {
                            const displayName = fieldNameMap.get(field) ?? field;
                            encodingFields.push(`${channel}=${displayName}`);
                        }
                    }
                    if (encodingFields.length > 0) {
                        contextLines.push(`- **Encoding**: ${encodingFields.join(', ')}`);
                    }
                }
                if (spec.config) {
                    const safeConfig = sanitizeSpecConfig(spec.config);
                    const configStr = Object.entries(safeConfig)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(', ');
                    if (configStr) {
                        contextLines.push(`- **Config**: ${configStr}`);
                    }
                }
                sections.push(contextLines.join('\n'));
            }
        }
        const ops = operationLog.getAll();
        sections.push(`## Recent Operations\n\n${buildOperationsTable(ops)}`);
        const specStats = specStore.stats();
        const resultStats = resultCacheStats();
        const datasets = deps.sourceManager.list();
        sections.push([
            '## Server State',
            '',
            `- **Uptime**: ${formatUptime(Date.now() - deps.serverStartTime)}`,
            `- **Cached specs**: ${specStats.entries}`,
            `- **Cached results**: ${resultStats.entries}`,
            `- **Datasets**: ${datasets.length}`,
        ].join('\n'));
        const report = sections.join('\n\n');
        return {
            content: [{
                    type: 'text',
                    text: report,
                }],
        };
    };
}
//# sourceMappingURL=bug-report.js.map