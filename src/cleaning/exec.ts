/**
 * Data-cleaning execution core (no MCP, no SourceManager) — runs a model-authored
 * Python clean(value) over a column's values and applies the result non-destructively.
 *
 * SECURITY (Tier 1): the author of this code is an LLM whose prompt embeds raw CSV cell
 * values, so a malicious cell can steer it into writing exfiltration/RCE (proven: see
 * local-orchestration/experiments/016-prompt-injection-author.ts — the default clean
 * model emitted `eval(open('~/.config/...'))` on a disguised payload). Before ANY model
 * code runs, the harness STATICALLY screens it (import allowlist + banned-name/dunder
 * deny) and runs it under POSIX resource limits (CPU/AS/FSIZE — enforced on Linux; macOS
 * honors a subset). Rejected code throws CleanRejected; the executor is NEVER reached.
 * This is a hardened deny-list, not a true jail — a hosted/multi-tenant deployment must
 * STILL run the whole engine in a network-denied, read-only container (see CLAUDE.md).
 */
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** Thrown when the static screen rejects model code (banned import/call/dunder) or the
 *  code defines no clean(). Callers (MCP/CLI) surface the message; the autonomous author
 *  loop turns it into validation feedback so the model retries with safe code. */
export class CleanRejected extends Error { constructor(reason: string) { super(reason); this.name = 'CleanRejected'; } }

export function pythonAvailable(): boolean {
  try { execFileSync('python3', ['--version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

// The trusted runner: screens the model code (argv[1]) with `ast` BEFORE compiling/exec'ing
// it, sets resource limits, then runs clean() over the values (argv[2]). The model code is
// loaded from a FILE (never interpolated into this string) so it cannot break out of the
// harness. Allowlist imports (the prompt only needs datetime/re); deny dangerous builtins by
// NAME (rebind-proof: `e = eval; e(...)` is caught) and all dunder attribute access (closes
// the `().__class__.__bases__[0].__subclasses__()` escape).
const RUNNER = String.raw`
import ast, sys, json, resource
ALLOWED_IMPORTS = {"datetime","time","re","math","json","string","decimal","fractions",
                   "unicodedata","collections","itertools","calendar","statistics","numbers"}
BANNED_NAMES = {"eval","exec","compile","open","input","breakpoint","__import__","__builtins__",
                "globals","locals","vars","getattr","setattr","delattr","memoryview","exit","quit"}
def screen(src):
    tree = ast.parse(src)
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            for a in n.names:
                if a.name.split('.')[0] not in ALLOWED_IMPORTS: raise ValueError("import not allowed: " + a.name)
        elif isinstance(n, ast.ImportFrom):
            mod = (n.module or "").split('.')[0]
            if mod not in ALLOWED_IMPORTS: raise ValueError("import not allowed: " + str(n.module))
        elif isinstance(n, ast.Name) and n.id in BANNED_NAMES:
            raise ValueError("name not allowed: " + n.id)
        elif isinstance(n, ast.Attribute) and n.attr.startswith("__") and n.attr.endswith("__"):
            raise ValueError("dunder attribute not allowed: " + n.attr)
    return tree
def limits():
    GB = 1024*1024*1024
    for res, lim in ((resource.RLIMIT_CPU, (10, 10)), (resource.RLIMIT_AS, (GB, GB)),
                     (resource.RLIMIT_FSIZE, (16*1024*1024, 16*1024*1024))):
        try: resource.setrlimit(res, lim)
        except Exception: pass
src = open(sys.argv[1]).read()
try:
    tree = screen(src)
except (ValueError, SyntaxError) as e:
    print(json.dumps({"rejected": str(e)})); sys.exit(0)
limits()
ns = {}
try:
    exec(compile(tree, "<clean>", "exec"), ns)
except Exception as e:
    print(json.dumps({"rejected": "module-level error: " + str(e)})); sys.exit(0)
clean = ns.get("clean")
if not callable(clean):
    print(json.dumps({"rejected": "no clean(value) function defined"})); sys.exit(0)
vals = json.load(open(sys.argv[2]))
out = []; err = 0
for v in vals:
    try:
        r = clean(v); out.append(None if r is None else str(r))
    except Exception:
        err += 1; out.append(None)
print(json.dumps({"cleaned": out, "errors": err}))
`;

// NOTE (scale): runs python3 synchronously and JSON.parses the result in one shot (maxBuffer 512MB,
// overflow ⇒ a graceful execFileSync error). Fine for the local single-user model; a hosted/multi-client
// deployment would stream + parse off the event loop. Out of scope here — see the security note above.
export function runPythonClean(code: string, values: (string | null)[]): { cleaned: (string | null)[]; errors: number } {
  const dir = mkdtempSync(join(tmpdir(), 'dolex-clean-'));
  try {
    const cf = join(dir, 'clean_src.py'); writeFileSync(cf, code);    // model code — read, never interpolated
    const vf = join(dir, 'v.json'); writeFileSync(vf, JSON.stringify(values));
    const rf = join(dir, 'runner.py'); writeFileSync(rf, RUNNER);     // trusted harness
    const raw = execFileSync('python3', [rf, cf, vf], { timeout: 60000, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    // Parse ONLY the final non-empty line: model-authored clean() (or imported modules)
    // may print debug output, which would otherwise poison JSON.parse. The protocol line
    // is always the last thing we print.
    const lines = raw.trimEnd().split('\n');
    const parsed = JSON.parse(lines[lines.length - 1]);
    if (parsed.rejected) throw new CleanRejected(parsed.rejected); // screen/exec/shape rejection
    return { cleaned: parsed.cleaned, errors: parsed.errors };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const isBlank = (x: unknown) => x === null || x === '' || x === undefined;

export interface CleanStats { rows: number; errors: number; changed: number; nulledFromValue: number; distinctBefore: number; distinctAfter: number }

export function cleanStats(raw: (string | null)[], cleaned: (string | null)[]): CleanStats {
  let changed = 0, nulledFromValue = 0;
  for (let i = 0; i < raw.length; i++) {
    if (String(raw[i] ?? '') !== String(cleaned[i] ?? '')) changed++;
    if (!isBlank(raw[i]) && isBlank(cleaned[i])) nulledFromValue++;
  }
  return {
    rows: raw.length, errors: 0, changed, nulledFromValue,
    distinctBefore: new Set(raw.filter((v) => !isBlank(v))).size,
    distinctAfter: new Set(cleaned.filter((v) => !isBlank(v))).size,
  };
}

export function safetyVerdict(raw: (string | null)[], cleaned: (string | null)[], errors: number): { ok: boolean; reason?: string } {
  const rows = raw.length;
  if (rows === 0) return { ok: false, reason: 'no rows to clean' };
  if (errors > rows * 0.5) return { ok: false, reason: `the function errored on ${errors}/${rows} rows` };
  const nonBlankBefore = raw.filter((v) => !isBlank(v)).length;
  const nonBlankAfter = cleaned.filter((v) => !isBlank(v)).length;
  if (nonBlankBefore > 0 && nonBlankAfter === 0) return { ok: false, reason: 'every value became blank/null — the function likely destroyed the column' };
  return { ok: true };
}

export function previewSample(raw: (string | null)[], cleaned: (string | null)[], n: number): { before: string | null; after: string | null }[] {
  const out: { before: string | null; after: string | null }[] = [];
  for (let i = 0; i < raw.length && out.length < n; i++) {
    if (String(raw[i] ?? '') !== String(cleaned[i] ?? '')) out.push({ before: raw[i], after: cleaned[i] });
  }
  return out;
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function applyCleanColumn(db: any, table: string, newColumn: string, rowids: number[], cleaned: (string | null)[]): void {
  db.exec(`ALTER TABLE ${q(table)} ADD COLUMN ${q(newColumn)}`);
  const upd = db.prepare(`UPDATE ${q(table)} SET ${q(newColumn)} = ? WHERE rowid = ?`);
  const tx = db.transaction((pairs: [string | null, number][]) => {
    // '' = missing — match the connector's "empty string is null" convention so the
    // stored value agrees with stats/safety (which treat '' as blank). [second-look fix]
    for (const [val, rid] of pairs) upd.run(val === '' ? null : val, rid);
  });
  tx(cleaned.map((v, i) => [v, rowids[i]] as [string | null, number]));
}
