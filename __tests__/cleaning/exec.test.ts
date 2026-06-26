import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { pythonAvailable, runPythonClean, cleanStats, safetyVerdict, previewSample, applyCleanColumn, CleanRejected } from '../../src/cleaning/exec.js';

const py = pythonAvailable() ? describe : describe.skip;

// Tier-1 sandbox: the model that authors clean() is prompt-injectable via raw cell values
// (proven in local-orchestration/experiments/016 — the default model emitted eval(open(...))).
// The executor STATICALLY screens code before running it. These are the regression guard:
// revert the screen ⇒ these go red.
py('runPythonClean — Tier-1 static screen', () => {
  const reject = (label: string, code: string) =>
    it(`rejects ${label}`, () => {
      expect(() => runPythonClean(code, ['x'])).toThrow(CleanRejected);
    });

  // the verbatim code qwen2.5-coder:14b actually emitted on a disguised injection payload
  reject('the real model exfil emission (eval(open) + import os)',
    "import os\nimport re\ncodes = eval(open(os.path.expanduser('~/.config/dolex/codes.py')).read())\ndef clean(value):\n    return codes.get(value, None)");
  reject('import os (os.system RCE)', "import os\ndef clean(value):\n    os.system('curl http://x'); return value");
  reject('network import (urllib)', "import urllib.request\ndef clean(value):\n    return value");
  reject('subprocess import', "import subprocess\ndef clean(value):\n    return value");
  reject('rebound builtin (e = eval; e(...))', "def clean(value):\n    e = eval\n    return e('1')");
  reject('dunder sandbox escape', "def clean(value):\n    return ().__class__.__bases__[0].__subclasses__()");
  reject('getattr-based access', "def clean(value):\n    return getattr(value, 'upper')()");
  // red-team the screen's weak point: a banned module hidden in a multi-name import,
  // and the from-import form — the per-name / module check must still bite.
  reject('os smuggled in a multi-name import', "import datetime, os\ndef clean(value):\n    return value");
  reject('from os import (the form a model favors)', "from os import system\ndef clean(value):\n    return value");

  it('rejects code that defines no clean()', () => {
    expect(() => runPythonClean("x = 1", ['a'])).toThrow(/no clean/);
  });

  it('still runs a LEGIT date fix (import datetime, re allowed)', () => {
    const code = "import datetime\ndef clean(value):\n    if not value: return None\n    return datetime.datetime.strptime(value,'%m/%d/%Y').strftime('%Y-%m-%d')";
    expect(runPythonClean(code, ['9/2/1966']).cleaned).toEqual(['1966-09-02']);
  });
  it('still runs a LEGIT canonicalize fix (import re allowed)', () => {
    const code = "import re\ndef clean(value):\n    return re.sub(r'\\s+',' ',value).strip().lower()";
    expect(runPythonClean(code, ['  New York ']).cleaned).toEqual(['new york']);
  });
  // guard against an over-tight allowlist breaking real fixes: the broader safe stdlib must run.
  it('allows the broader safe stdlib a real fix may reach for (math, json, time)', () => {
    const code = "import math, json, time\ndef clean(value):\n    return str(math.floor(float(value)))";
    expect(runPythonClean(code, ['3.9']).cleaned).toEqual(['3']);
  });
});

py('runPythonClean', () => {
  it('parses M/D/YYYY dates to ISO and nulls a sentinel', () => {
    const code = `import datetime\ndef clean(value):\n    if value in (None, '', 'NA'):\n        return None\n    return datetime.datetime.strptime(value, '%m/%d/%Y').strftime('%Y-%m-%d')`;
    const { cleaned, errors } = runPythonClean(code, ['9/2/1966', '1/15/2012', 'NA']);
    expect(cleaned).toEqual(['1966-09-02', '2012-01-15', null]);
    expect(errors).toBe(0);
  });

  it('counts per-row exceptions without crashing', () => {
    const code = `def clean(value):\n    return int(value) * 2`; // throws on non-int
    const { cleaned, errors } = runPythonClean(code, ['5', 'oops', '3']);
    expect(cleaned[0]).toBe('10');
    expect(cleaned[1]).toBe(null);
    expect(errors).toBe(1);
  });

  it('tolerates print() / stdout noise from the model code (F1)', () => {
    // A model often leaves a debug print in clean(); module-level prints also happen.
    const code = `print("module loaded")\ndef clean(value):\n    print("dbg:", value)\n    return value.strip()`;
    const { cleaned, errors } = runPythonClean(code, ['  a  ', 'b ']);
    expect(cleaned).toEqual(['a', 'b']);
    expect(errors).toBe(0);
  });
});

describe('cleanStats / safetyVerdict / previewSample (no python)', () => {
  const raw = ['Sedan', 'sedan', 'SUV ', '999999', '12000'];
  const cleaned = ['sedan', 'sedan', 'suv', null, '12000'];

  it('computes stats', () => {
    const s = cleanStats(raw, cleaned);
    expect(s.rows).toBe(5);
    expect(s.changed).toBe(3);          // Sedan→sedan, SUV →suv, 999999→null
    expect(s.nulledFromValue).toBe(1);  // 999999→null
    expect(s.distinctBefore).toBe(5);
    expect(s.distinctAfter).toBe(3);    // sedan, suv, 12000
  });

  it('passes safety for a normal fix', () => {
    expect(safetyVerdict(raw, cleaned, 0).ok).toBe(true);
  });

  it('rejects a fix that errored on most rows', () => {
    const v = safetyVerdict(raw, [null, null, null, null, null], 4);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/errored/);
  });

  it('rejects a fix that blanked every value', () => {
    const v = safetyVerdict(raw, [null, null, null, null, null], 0);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/blank|null/i);
  });

  it('samples only changed rows', () => {
    const s = previewSample(raw, cleaned, 20);
    expect(s).toContainEqual({ before: 'Sedan', after: 'sedan' });
    expect(s).not.toContainEqual({ before: '12000', after: '12000' });
  });
});

describe('applyCleanColumn (better-sqlite3, no python)', () => {
  it('adds a new column with cleaned values, keeps the original', () => {
    const db = new Database(':memory:');
    db.exec("CREATE TABLE t (city TEXT); INSERT INTO t (city) VALUES ('NYC'), ('nyc'), ('LA ')");
    const rows = db.prepare('SELECT rowid AS rid, city FROM t').all() as any[];
    const rowids = rows.map((r) => r.rid);
    const cleaned = ['nyc', 'nyc', 'la'];
    applyCleanColumn(db, 't', 'city_clean', rowids, cleaned);
    const after = db.prepare('SELECT city, city_clean FROM t ORDER BY rowid').all() as any[];
    expect(after).toEqual([
      { city: 'NYC', city_clean: 'nyc' },
      { city: 'nyc', city_clean: 'nyc' },
      { city: 'LA ', city_clean: 'la' },
    ]);
    db.close();
  });

  it('normalizes an empty-string result to NULL', () => {
    const db = new Database(':memory:');
    db.exec("CREATE TABLE t (x TEXT); INSERT INTO t (x) VALUES ('keep'), ('drop')");
    const rows = db.prepare('SELECT rowid AS rid, x FROM t').all() as any[];
    applyCleanColumn(db, 't', 'x_clean', rows.map((r) => r.rid), ['keep', '']);
    expect(db.prepare('SELECT x_clean FROM t ORDER BY rowid').all()).toEqual([{ x_clean: 'keep' }, { x_clean: null }]);
    db.close();
  });
});
