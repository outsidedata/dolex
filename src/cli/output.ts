/**
 * Terminal output helpers: TTY-aware ANSI colors, ASCII tables, section
 * headings. Honors the NO_COLOR convention and disables styling when stdout is
 * not a TTY.
 *
 * Human-facing chatter goes to stderr in "machine mode" (when the command emits
 * JSON / raw HTML / data to stdout) so output stays pipe-clean; otherwise it
 * goes to stdout.
 */

const COLOR_ENABLED =
  !process.env.NO_COLOR && process.stdout.isTTY === true && process.env.TERM !== 'dumb';

const ESC = String.fromCharCode(27);

function wrap(code: number, s: string): string {
  return COLOR_ENABLED ? `${ESC}[${code}m${s}${ESC}[0m` : s;
}

export const c = {
  bold: (s: string) => wrap(1, s),
  dim: (s: string) => wrap(2, s),
  red: (s: string) => wrap(31, s),
  green: (s: string) => wrap(32, s),
  yellow: (s: string) => wrap(33, s),
  blue: (s: string) => wrap(34, s),
  magenta: (s: string) => wrap(35, s),
  cyan: (s: string) => wrap(36, s),
  gray: (s: string) => wrap(90, s),
};

/** Print a line to stdout. */
export function out(line = ''): void {
  process.stdout.write(line + '\n');
}

/** Print a line to stderr (status / errors / human chatter in machine mode). */
export function err(line = ''): void {
  process.stderr.write(line + '\n');
}

export function heading(text: string, sink: (s: string) => void = out): void {
  sink('');
  sink(c.bold(c.cyan(text)));
}

export function kv(key: string, value: string, sink: (s: string) => void = out): void {
  sink(`  ${c.gray(key.padEnd(12))} ${value}`);
}

export function bullet(text: string, sink: (s: string) => void = out): void {
  sink(`  ${c.dim('•')} ${text}`);
}

export function success(text: string, sink: (s: string) => void = out): void {
  sink(`${c.green('✓')} ${text}`);
}

export function warn(text: string, sink: (s: string) => void = err): void {
  sink(`${c.yellow('!')} ${text}`);
}

export function fail(text: string): void {
  err(`${c.red('✗')} ${text}`);
}

export function hint(text: string, sink: (s: string) => void = out): void {
  sink(c.dim(text));
}

// ─── ASCII TABLE ──────────────────────────────────────────────────────────

const MAX_CELL = 40;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (s.length > MAX_CELL) s = s.slice(0, MAX_CELL - 1) + '…';
  return s;
}

/**
 * Render an aligned ASCII table. Numeric columns are right-aligned.
 * `columns` is the ordered list of keys; rows are plain objects.
 */
export function table(columns: string[], rows: Record<string, unknown>[]): string {
  if (columns.length === 0) return '(no columns)';

  const cells = rows.map((r) => columns.map((col) => cell(r[col])));
  const numeric = columns.map(
    (col) =>
      rows.length > 0 &&
      rows.every((r) => {
        const v = r[col];
        return v === null || v === undefined || v === '' || typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
      }),
  );

  const widths = columns.map((col, i) =>
    Math.max(col.length, ...cells.map((row) => row[i].length), 0),
  );

  const pad = (s: string, w: number, right: boolean) =>
    right ? s.padStart(w) : s.padEnd(w);

  const header = columns.map((col, i) => c.bold(pad(col, widths[i], numeric[i]))).join('  ');
  const rule = c.gray(widths.map((w) => '─'.repeat(w)).join('  '));
  const body = cells.map((row) => row.map((v, i) => pad(v, widths[i], numeric[i])).join('  '));

  return [header, rule, ...body].join('\n');
}

// ─── CSV ────────────────────────────────────────────────────────────────

function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(csvField).join(',')];
  for (const r of rows) lines.push(columns.map((col) => csvField(r[col])).join(','));
  return lines.join('\n');
}
