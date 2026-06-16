/**
 * Shared chart-output logic for `visualize` and `refine`: writes the HTML to
 * disk (or stdout), optionally renders a PNG and opens a browser, then prints
 * either a human-readable report or machine-readable JSON.
 */

import { type ParsedArgs, str, bool } from './args.js';
import * as o from './output.js';
import { defaultChartPath, writeHtmlFile, openInBrowser, renderPng } from './render.js';

export interface EmitOptions {
  args: ParsedArgs;
  /** Response body from handleVisualizeCore / handleRefine (parsed JSON). */
  body: Record<string, any>;
  /** Rendered chart HTML, if the pattern has an HTML builder. */
  html: string | undefined;
}

/**
 * Emit a chart result. Returns the process exit code (0 on success, 1 if the
 * pattern produced no HTML or PNG export failed).
 */
export async function emitChart({ args, body, html }: EmitOptions): Promise<number> {
  if (bool(args, 'stdout') && bool(args, 'json')) {
    o.fail('--stdout and --json are mutually exclusive (both write to stdout).');
    return 1;
  }

  const machine = bool(args, 'json') || bool(args, 'stdout');
  const log = machine ? o.err : o.out;
  const specId: string = body.specId;
  const isRefine = Array.isArray(body.changes);

  if (!html) {
    o.fail(`Pattern "${body.recommended?.pattern ?? 'selected'}" has no HTML renderer — nothing to write.`);
    return 1;
  }

  // ── Resolve output destination ──
  const outputs: { html?: string; png?: string } = {};

  if (bool(args, 'stdout')) {
    process.stdout.write(html);
    if (!html.endsWith('\n')) process.stdout.write('\n');
  } else {
    const outPath = str(args, 'out') ?? defaultChartPath(specId);
    outputs.html = writeHtmlFile(html, outPath);
  }

  const pngPath = str(args, 'png');
  if (pngPath) {
    try {
      outputs.png = await renderPng(html, pngPath);
    } catch (e) {
      o.fail(e instanceof Error ? e.message : String(e));
      return 1;
    }
  }

  if (bool(args, 'open')) {
    const toOpen = outputs.html ?? outputs.png;
    if (toOpen) openInBrowser(toOpen);
  }

  // ── Machine-readable JSON ──
  if (bool(args, 'json')) {
    process.stdout.write(JSON.stringify({ ...body, outputs }, null, 2) + '\n');
    return 0;
  }

  // ── Human-readable report ──
  if (isRefine) {
    o.success(`Refined ${o.c.bold(specId)}`, log);
    for (const change of body.changes as string[]) o.bullet(change, log);
    if (body.alternatives?.length) {
      o.kv('switch to', (body.alternatives as string[]).join(', '), log);
    }
  } else {
    const rec = body.recommended ?? {};
    o.success(`${o.c.bold(rec.pattern ?? '?')}${rec.title ? `  ${o.c.dim('"' + rec.title + '"')}` : ''}`, log);
    if (rec.reasoning) o.bullet(rec.reasoning, log);
    if (body.alternatives?.length) {
      o.heading('Alternatives', log);
      for (const alt of body.alternatives as { pattern: string; reasoning: string }[]) {
        o.bullet(`${o.c.cyan(alt.pattern)} — ${alt.reasoning}`, log);
      }
    }
    if (body.dataShape) {
      const ds = body.dataShape;
      const shape = `${ds.rowCount} rows × ${ds.columnCount} cols`;
      o.kv('data', ds.truncated ? `${shape} ${o.c.yellow(`(truncated from ${ds.totalSourceRows})`)}` : shape, log);
    }
    if (body.compound) o.kv('layout', 'chart + companion data table', log);
  }

  if (body.notes?.length) {
    o.heading('Notes', log);
    for (const note of body.notes as string[]) o.warn(note, log);
  }

  o.heading('Output', log);
  if (outputs.html) o.kv('chart', outputs.html, log);
  if (outputs.png) o.kv('png', outputs.png, log);
  o.kv('hash', o.c.bold(specId), log);
  o.hint(`Refine it:  dolex refine ${specId} [--sort desc] [--palette blueRed] [--switch-pattern <id>]`, log);

  return 0;
}
