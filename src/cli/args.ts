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

function looksLikeValue(token: string | undefined): boolean {
  if (token === undefined) return false;
  if (token === '-') return true; // stdin sentinel is a legitimate value
  if (!token.startsWith('-')) return true;
  // A leading '-' followed by a number (e.g. -0.5, -3) is a value, not a flag.
  return !Number.isNaN(Number(token));
}

export function parseArgs(argv: string[], opts: ParseOptions = {}): ParsedArgs {
  const booleans = new Set(opts.booleans ?? []);
  const aliases = opts.aliases ?? {};
  const out: ParsedArgs = { _: [] };

  const resolve = (k: string) => aliases[k] ?? k;

  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];

    if (tok === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }

    const isLong = tok.startsWith('--');
    const isShort = !isLong && tok.startsWith('-') && tok.length > 1 && tok !== '-';

    if (isLong || isShort) {
      let key = tok.slice(isLong ? 2 : 1);
      let inlineVal: string | undefined;

      const eq = key.indexOf('=');
      if (eq !== -1) {
        inlineVal = key.slice(eq + 1);
        key = key.slice(0, eq);
      }

      // `--no-foo` clears a boolean flag.
      if (isLong && inlineVal === undefined && key.startsWith('no-')) {
        out[resolve(key.slice(3))] = false;
        i += 1;
        continue;
      }

      key = resolve(key);

      // Boolean flags: `--flag` → true, `--flag=false|0|no|off` → false, else true.
      if (booleans.has(key)) {
        out[key] = inlineVal === undefined ? true : !/^(false|0|no|off)$/i.test(inlineVal);
        i += 1;
        continue;
      }

      if (inlineVal !== undefined) {
        out[key] = inlineVal;
        i += 1;
        continue;
      }

      if (looksLikeValue(argv[i + 1])) {
        out[key] = argv[i + 1];
        i += 2;
        continue;
      }

      // Value flag with no value present → treat as a boolean toggle.
      out[key] = true;
      i += 1;
      continue;
    }

    out._.push(tok);
    i += 1;
  }

  return out;
}

/** Read a flag as a string, or undefined if absent / boolean. */
export function str(args: ParsedArgs, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

/** Read a flag as a boolean (presence or explicit true). */
export function bool(args: ParsedArgs, key: string): boolean {
  return args[key] === true;
}

/** Read a flag as a number, or undefined if absent / unparseable. */
export function num(args: ParsedArgs, key: string): number | undefined {
  const v = args[key];
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/** Split a comma-separated flag value into trimmed, non-empty parts. */
export function list(args: ParsedArgs, key: string): string[] | undefined {
  const v = str(args, key);
  if (v === undefined) return undefined;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
