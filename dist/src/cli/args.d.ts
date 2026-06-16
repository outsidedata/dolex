/**
 * Tiny dependency-free argument parser.
 *
 * Supports: `--flag value`, `--flag=value`, `-x value`, `-x`, `--no-flag`,
 * `--` (stop parsing), and positionals. A single `-` is treated as a positional
 * (the stdin convention), not a flag.
 *
 * Callers declare which flags are booleans (so a bare `--open` does not swallow
 * the next token) and any short aliases.
 */
export interface ParseOptions {
    /** Flag names that never take a value (e.g. `open`, `json`). */
    booleans?: string[];
    /** Map short/alternate names to canonical names (e.g. `{ i: 'intent' }`). */
    aliases?: Record<string, string>;
}
export interface ParsedArgs {
    /** Positional arguments, in order. */
    _: string[];
    /** Parsed flags keyed by canonical name. */
    [key: string]: string | boolean | string[];
}
export declare function parseArgs(argv: string[], opts?: ParseOptions): ParsedArgs;
/** Read a flag as a string, or undefined if absent / boolean. */
export declare function str(args: ParsedArgs, key: string): string | undefined;
/** Read a flag as a boolean (presence or explicit true). */
export declare function bool(args: ParsedArgs, key: string): boolean;
/** Read a flag as a number, or undefined if absent / unparseable. */
export declare function num(args: ParsedArgs, key: string): number | undefined;
/** Split a comma-separated flag value into trimmed, non-empty parts. */
export declare function list(args: ParsedArgs, key: string): string[] | undefined;
