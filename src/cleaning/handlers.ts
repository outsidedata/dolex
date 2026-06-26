/**
 * Per-issue cleaning handlers + the acceptance-test validator (the autonomous
 * guardrail: trust the validated output, never the generator). Model-free.
 *
 * Ported verbatim from local-orchestration/src/clean.ts (the proven reviewer-bench
 * handlers) — the python runner is now the shared exec, so there is exactly ONE.
 */
import { runPythonClean } from './exec.js';
import type { QualityFinding } from '../analysis/quality.js';

export interface AcceptResult { ok: boolean; summary: string; fail?: string }
interface Handler {
  task: (f: QualityFinding) => string | null;
  accept: (pairs: [string, any][], f: QualityFinding) => AcceptResult;
}

const blank = (x: any) => x === null || x === '' || x === undefined;
const isoLike = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(String(s));
// Real date STRUCTURE only — D/M/Y, "Mon DD YYYY", or ISO. A bare 4-digit number is NOT a
// date (else a duration column like *_time(seconds) gets "cleaned" into epoch dates).
const looksDate = (s: string) => /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|([A-Za-z]{3,}\.?\s+\d{1,2},?\s+\d{4})|(\d{4}-\d{2}-\d{2})/.test(String(s));

export const HANDLERS: Record<string, Handler> = {
  'non-iso-date': {
    task: () => 'The values are dates in a NON-ISO format. Parse each and return it as ISO YYYY-MM-DD (return None if it is not a date).',
    accept: (pairs) => {
      const nonblank = pairs.filter(([o]) => !blank(o));
      const d = nonblank.filter(([o]) => looksDate(o));
      // Only treat this as a date column if MOST values are real dates — guards against
      // cleaning a non-date column that has a few coincidentally date-like values.
      const isDateColumn = nonblank.length > 0 && d.length >= nonblank.length * 0.5;
      const conv = d.filter(([, c]) => isoLike(c));
      const ok = isDateColumn && conv.length >= Math.floor(d.length * 0.9);
      const badEx = d.find(([, c]) => !isoLike(c) && !blank(c));
      const why = !isDateColumn ? `only ${d.length}/${nonblank.length} values are real dates — not a date column` : badEx ? `for ${JSON.stringify(badEx[0])} returned ${JSON.stringify(badEx[1])}, expected ISO YYYY-MM-DD` : undefined;
      return { ok, summary: `${conv.length}/${d.length} date-like → ISO (${d.length}/${nonblank.length} look like dates)`, fail: why };
    },
  },
  'mixed-type': {
    task: (f) => { const m = f.detail.match(/non-numeric value "([^"]+)"/); return m ? `The value ${JSON.stringify(m[1])} is a missing-value sentinel coerced into a numeric column. Return None for it; return the number (as a float) otherwise.` : null; },
    accept: (pairs, f) => {
      const m = f.detail.match(/non-numeric value "([^"]+)"/); const lit = m ? m[1] : '';
      const sent = pairs.filter(([o]) => o === lit);
      const badSent = sent.find(([, c]) => !blank(c));
      const badNum = pairs.filter(([o]) => o !== lit && !blank(o)).find(([o, c]) => !blank(c) && Number(c) !== Number(o));
      const bad = badSent || badNum;
      return { ok: sent.length > 0 && !bad, summary: `${sent.length} ${JSON.stringify(lit)} sentinels → None`, fail: bad ? `for ${JSON.stringify(bad[0])} returned ${JSON.stringify(bad[1])}` : undefined };
    },
  },
  'sentinel-value': {
    task: (f) => { const m = f.detail.match(/Extreme value ([\d.eE+-]+)/) || f.detail.match(/sentinel:\s*"([^"]+)"/); return m ? `The value ${m[1]} is a missing-value sentinel, not real data. Return None for it; return the value otherwise.` : null; },
    accept: (pairs, f) => {
      const m = f.detail.match(/Extreme value ([\d.eE+-]+)/) || f.detail.match(/sentinel:\s*"([^"]+)"/); const lit = m ? m[1] : '';
      const sent = pairs.filter(([o]) => o === lit || Number(o) === Number(lit));
      const bad = sent.find(([, c]) => !blank(c));
      return { ok: sent.length > 0 && !bad, summary: `${sent.length} ${JSON.stringify(lit)} sentinels → None`, fail: bad ? `for ${JSON.stringify(bad[0])} returned ${JSON.stringify(bad[1])}` : undefined };
    },
  },
  'dirty-categories': {
    task: () => 'Values differ only by case/whitespace and split one category. Canonicalize each value (strip surrounding whitespace and lowercase) so variants collapse.',
    accept: (pairs) => {
      const m = new Map(pairs.map(([o, c]) => [o, c] as const));
      // find any case/space variant pair in the sample and check they collapse
      const keys = [...m.keys()];
      let merged = false, checked = 0;
      for (const a of keys) for (const b of keys) {
        if (a !== b && a.trim().toLowerCase() === b.trim().toLowerCase()) { checked++; if (m.get(a) === m.get(b) && !blank(m.get(a))) merged = true; }
      }
      const ok = checked === 0 ? pairs.every(([, c]) => typeof c === 'string' && c === (c as string).trim().toLowerCase()) : merged;
      return { ok, summary: checked > 0 ? `${checked} case/space variant pair(s) collapse` : 'all values canonical' };
    },
  },
};

/** Run the model-authored code over the sample values and apply the issue's
 *  acceptance test. Uses the shared exec (string|null normalized) — the same
 *  executor the MCP tool uses, so there is exactly ONE python runner. */
export function validateFix(finding: QualityFinding, code: string, sampleVals: string[]): AcceptResult {
  const handler = finding.column ? HANDLERS[finding.issue] : undefined;
  if (!handler) return { ok: false, summary: `no handler for issue "${finding.issue}"` };
  const { cleaned } = runPythonClean(code, sampleVals);
  const pairs = sampleVals.map((o, i) => [o, cleaned[i]] as [string, any]);
  return handler.accept(pairs, finding);
}
