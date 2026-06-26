/**
 * Domain-context sidecar — a persisted SEMANTIC LAYER for a dataset.
 *
 * Mined from Anthropic's knowledge-work `data` plugin (data-context-extractor
 * skill): a reusable document capturing the tribal knowledge a profiler can't see
 * — what entities/terms mean, how metrics are DEFINED (plain English + the exact
 * SQL), standing filters that should always apply (test rows, soft-deletes),
 * column gotchas (timezones, units, NULL conventions), and a few canonical example
 * queries. Injected into the analyst's system prompt, it grounds SQL generation and
 * cuts hallucinated relationships/metric definitions across sessions.
 *
 * Model-free core, exactly like the cleaning core: this module DEFINES the shape,
 * loads/saves the sidecar, and renders it for a prompt. AUTHORING is the caller's
 * job — a model (the loop's local model, the MCP assistant) fills the schema via
 * the authoring prompt, or a human hand-writes the JSON. The core never calls a
 * model.
 */
import * as fs from 'fs';
import * as path from 'path';
/** The sidecar path for a dataset CSV: `<dir>/<base>.context.json` (sits beside the
 *  `.dolex.json` transform manifest, same convention). */
export function dataContextPath(datasetPath) {
    const dir = path.dirname(datasetPath);
    const base = path.basename(datasetPath).replace(/\.[^.]+$/, '');
    return path.join(dir, `${base}.context.json`);
}
/** Load a sidecar if present and well-formed. Best-effort: a missing or corrupt
 *  file yields null (the analyst simply runs without extra grounding). */
export function loadDataContext(datasetPath) {
    try {
        const p = dataContextPath(datasetPath);
        if (!fs.existsSync(p))
            return null;
        const ctx = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return ctx && typeof ctx === 'object' && typeof ctx.dataset === 'string' ? ctx : null;
    }
    catch {
        return null;
    }
}
/** Persist a sidecar atomically (temp + rename — same discipline as the registry). */
export function saveDataContext(datasetPath, ctx) {
    const p = dataContextPath(datasetPath);
    const tmp = `${p}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ctx, null, 2), 'utf-8');
    fs.renameSync(tmp, p);
}
/** Render a context into a compact prompt block. Only non-empty sections appear;
 *  returns '' for an empty/edge context so nothing is injected. */
export function renderDataContext(ctx) {
    if (!ctx)
        return '';
    const parts = [];
    if (ctx.entities?.length) {
        parts.push('TERMS: ' + ctx.entities.map((e) => `${e.term} = ${e.meaning}`).join('; '));
    }
    if (ctx.metrics?.length) {
        parts.push('METRICS:\n' + ctx.metrics.map((m) => `• ${m.name}: ${m.definition} → SQL: ${m.sql}${m.caveats ? ` (caveat: ${m.caveats})` : ''}`).join('\n'));
    }
    if (ctx.standardFilters?.length) {
        parts.push('STANDARD FILTERS (apply unless the question overrides): ' + ctx.standardFilters.map((f) => `${f.description} [${f.sql}]`).join('; '));
    }
    if (ctx.columnNotes?.length) {
        parts.push('COLUMN NOTES: ' + ctx.columnNotes.map((c) => `${c.column} — ${c.note}`).join('; '));
    }
    if (ctx.queryExamples?.length) {
        parts.push('EXAMPLE QUERIES:\n' + ctx.queryExamples.map((q) => `• ${q.question}\n  ${q.sql}`).join('\n'));
    }
    if (parts.length === 0)
        return '';
    return 'DOMAIN CONTEXT — curated knowledge about this dataset. Prefer these definitions and apply the standard filters:\n' + parts.join('\n');
}
/** JSON schema for caller-driven authoring (constrained-output for a model). */
export const DATA_CONTEXT_SCHEMA = {
    type: 'object',
    properties: {
        dataset: { type: 'string' },
        entities: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, meaning: { type: 'string' } }, required: ['term', 'meaning'] } },
        metrics: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, definition: { type: 'string' }, sql: { type: 'string' }, caveats: { type: 'string' } }, required: ['name', 'definition', 'sql'] } },
        standardFilters: { type: 'array', items: { type: 'object', properties: { description: { type: 'string' }, sql: { type: 'string' } }, required: ['description', 'sql'] } },
        columnNotes: { type: 'array', items: { type: 'object', properties: { column: { type: 'string' }, note: { type: 'string' } }, required: ['column', 'note'] } },
        queryExamples: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, sql: { type: 'string' } }, required: ['question', 'sql'] } },
    },
    required: ['dataset'],
};
/** Authoring prompt for a caller's model: turn schema + sample rows + the quality
 *  audit into a DataContext. The core stays model-free; the caller runs this. */
export function buildContextAuthorPrompt(dataset, schemaText, sampleRows, auditNote) {
    return (`You are documenting a dataset so future analyses are grounded. Produce a DataContext JSON for table "${dataset}".\n\n` +
        `SCHEMA: ${schemaText}\n\n` +
        `SAMPLE ROWS:\n${sampleRows}\n\n` +
        (auditNote ? `DATA-QUALITY AUDIT:\n${auditNote}\n\n` : '') +
        `Capture ONLY what is genuinely useful and supported by the data: ambiguous TERMS, the few KEY METRICS (with the exact SQL to compute each), ` +
        `any STANDARD FILTERS that should usually apply (sentinels/test rows the audit flagged), per-column GOTCHAS (units, timezones, NULL meaning), ` +
        `and 1-3 canonical example queries. Do NOT invent business rules you cannot infer. Omit a section rather than pad it. Output JSON only.`);
}
