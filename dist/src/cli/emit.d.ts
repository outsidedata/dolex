/**
 * Shared chart-output logic for `visualize` and `refine`: writes the HTML to
 * disk (or stdout), optionally renders a PNG and opens a browser, then prints
 * either a human-readable report or machine-readable JSON.
 */
import { type ParsedArgs } from './args.js';
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
export declare function emitChart({ args, body, html }: EmitOptions): Promise<number>;
