import { describe, it, expect } from 'vitest';
import { pythonAvailable } from '../../src/cleaning/exec.js';
import { validateFix, HANDLERS } from '../../src/cleaning/handlers.js';
import type { QualityFinding } from '../../src/analysis/quality.js';

const py = pythonAvailable() ? describe : describe.skip;

py('validateFix (acceptance-test guardrail)', () => {
  const dateFinding = { table: 't', column: 'd', issue: 'non-iso-date', severity: 'high', detail: '' } as QualityFinding;

  it('accepts a correct M/D/Y → ISO fix', () => {
    const code = 'import datetime\ndef clean(value):\n    if not value: return None\n    return datetime.datetime.strptime(value, "%m/%d/%Y").strftime("%Y-%m-%d")';
    const r = validateFix(dateFinding, code, ['9/2/1966', '1/15/2012']);
    expect(r.ok).toBe(true);
  });

  it('REJECTS a fix that leaves dates non-ISO (the guardrail bites)', () => {
    const code = 'def clean(value):\n    return value'; // identity — not ISO
    const r = validateFix(dateFinding, code, ['9/2/1966', '1/15/2012']);
    expect(r.ok).toBe(false);
    expect(r.fail).toBeTruthy();
  });

  it('has the four handled issue types', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(['dirty-categories', 'mixed-type', 'non-iso-date', 'sentinel-value']);
  });
});
