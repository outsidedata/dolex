/**
 * Terminal output helpers: TTY-aware ANSI colors, ASCII tables, section
 * headings. Honors the NO_COLOR convention and disables styling when stdout is
 * not a TTY.
 *
 * Human-facing chatter goes to stderr in "machine mode" (when the command emits
 * JSON / raw HTML / data to stdout) so output stays pipe-clean; otherwise it
 * goes to stdout.
 */
export declare const c: {
    bold: (s: string) => string;
    dim: (s: string) => string;
    red: (s: string) => string;
    green: (s: string) => string;
    yellow: (s: string) => string;
    blue: (s: string) => string;
    magenta: (s: string) => string;
    cyan: (s: string) => string;
    gray: (s: string) => string;
};
/** Print a line to stdout. */
export declare function out(line?: string): void;
/** Print a line to stderr (status / errors / human chatter in machine mode). */
export declare function err(line?: string): void;
export declare function heading(text: string, sink?: (s: string) => void): void;
export declare function kv(key: string, value: string, sink?: (s: string) => void): void;
export declare function bullet(text: string, sink?: (s: string) => void): void;
export declare function success(text: string, sink?: (s: string) => void): void;
export declare function warn(text: string, sink?: (s: string) => void): void;
export declare function fail(text: string): void;
export declare function hint(text: string, sink?: (s: string) => void): void;
/**
 * Render an aligned ASCII table. Numeric columns are right-aligned.
 * `columns` is the ordered list of keys; rows are plain objects.
 */
export declare function table(columns: string[], rows: Record<string, unknown>[]): string;
export declare function toCsv(columns: string[], rows: Record<string, unknown>[]): string;
