/**
 * Terminal output helpers: TTY-aware ANSI colors, ASCII tables, section
 * headings. Honors the NO_COLOR convention and disables styling when stdout is
 * not a TTY.
 *
 * Human-facing chatter goes to stderr in "machine mode" (when the command emits
 * JSON / raw HTML / data to stdout) so output stays pipe-clean; otherwise it
 * goes to stdout.
 */
const COLOR_ENABLED = !process.env.NO_COLOR && process.stdout.isTTY === true && process.env.TERM !== 'dumb';
const ESC = String.fromCharCode(27);
function wrap(code, s) {
    return COLOR_ENABLED ? `${ESC}[${code}m${s}${ESC}[0m` : s;
}
export const c = {
    bold: (s) => wrap(1, s),
    dim: (s) => wrap(2, s),
    red: (s) => wrap(31, s),
    green: (s) => wrap(32, s),
    yellow: (s) => wrap(33, s),
    blue: (s) => wrap(34, s),
    magenta: (s) => wrap(35, s),
    cyan: (s) => wrap(36, s),
    gray: (s) => wrap(90, s),
};
/** Print a line to stdout. */
export function out(line = '') {
    process.stdout.write(line + '\n');
}
/** Print a line to stderr (status / errors / human chatter in machine mode). */
export function err(line = '') {
    process.stderr.write(line + '\n');
}
export function heading(text, sink = out) {
    sink('');
    sink(c.bold(c.cyan(text)));
}
export function kv(key, value, sink = out) {
    sink(`  ${c.gray(key.padEnd(12))} ${value}`);
}
export function bullet(text, sink = out) {
    sink(`  ${c.dim('•')} ${text}`);
}
export function success(text, sink = out) {
    sink(`${c.green('✓')} ${text}`);
}
export function warn(text, sink = err) {
    sink(`${c.yellow('!')} ${text}`);
}
export function fail(text) {
    err(`${c.red('✗')} ${text}`);
}
export function hint(text, sink = out) {
    sink(c.dim(text));
}
// ─── ASCII TABLE ──────────────────────────────────────────────────────────
const MAX_CELL = 40;
function cell(value) {
    if (value === null || value === undefined)
        return '';
    let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (s.length > MAX_CELL)
        s = s.slice(0, MAX_CELL - 1) + '…';
    return s;
}
/**
 * Render an aligned ASCII table. Numeric columns are right-aligned.
 * `columns` is the ordered list of keys; rows are plain objects.
 */
export function table(columns, rows) {
    if (columns.length === 0)
        return '(no columns)';
    const cells = rows.map((r) => columns.map((col) => cell(r[col])));
    const numeric = columns.map((col) => rows.length > 0 &&
        rows.every((r) => {
            const v = r[col];
            return v === null || v === undefined || v === '' || typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
        }));
    const widths = columns.map((col, i) => Math.max(col.length, ...cells.map((row) => row[i].length), 0));
    const pad = (s, w, right) => right ? s.padStart(w) : s.padEnd(w);
    const header = columns.map((col, i) => c.bold(pad(col, widths[i], numeric[i]))).join('  ');
    const rule = c.gray(widths.map((w) => '─'.repeat(w)).join('  '));
    const body = cells.map((row) => row.map((v, i) => pad(v, widths[i], numeric[i])).join('  '));
    return [header, rule, ...body].join('\n');
}
// ─── CSV ────────────────────────────────────────────────────────────────
function csvField(value) {
    if (value === null || value === undefined)
        return '';
    const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(columns, rows) {
    const lines = [columns.map(csvField).join(',')];
    for (const r of rows)
        lines.push(columns.map((col) => csvField(r[col])).join(','));
    return lines.join('\n');
}
