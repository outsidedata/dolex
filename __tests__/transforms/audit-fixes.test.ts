/**
 * Tests for audit fixes: P0/P1/P2 bug fixes and edge cases.
 * Covers: round negative decimals, string/date comparisons, strict equality,
 * cut simplification, filter coercion, partitionBy/filter validation,
 * percentile_rank binary search, string escapes, duplicate batch names.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '../../src/transforms/parser.js';
import { evaluate, evaluateExpression } from '../../src/transforms/evaluator.js';
import { tokenize } from '../../src/transforms/tokenizer.js';
import { executeSingleTransform, executeBatchTransform } from '../../src/transforms/pipeline.js';
import { TransformMetadata } from '../../src/transforms/metadata.js';
import Database from 'better-sqlite3';

function ev(expr: string, row: Record<string, any> = {}) {
  return evaluate(parse(expr), { row });
}

function createTestDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE data (
      name TEXT,
      age REAL,
      score REAL,
      gender TEXT,
      date TEXT
    )
  `);
  const insert = db.prepare('INSERT INTO data (name, age, score, gender, date) VALUES (?, ?, ?, ?, ?)');
  const tx = db.transaction(() => {
    insert.run('Alice', 25, 80, 'F', '2024-06-15');
    insert.run('Bob', 35, 90, 'M', '2024-01-10');
    insert.run('Carol', 55, 70, 'F', '2024-09-20');
    insert.run('Dave', 17, 60, 'M', '2024-03-05');
    insert.run('Eve', 42, 85, 'F', '2024-12-25');
  });
  tx();
  const metadata = new TransformMetadata(db);
  metadata.init();
  const sourceColumns = ['name', 'age', 'score', 'gender', 'date'];
  return { db, metadata, sourceColumns };
}

// ─── Round with negative decimals (B2) ──────────────────────────────────────

describe('round() negative decimals', () => {
  it('round(145, -1) = 150', () => {
    expect(ev('round(x, -1)', { x: 145 })).toBe(150);
  });

  it('round(1234, -2) = 1200', () => {
    expect(ev('round(x, -2)', { x: 1234 })).toBe(1200);
  });

  it('round(1500, -3) = 2000', () => {
    expect(ev('round(x, -3)', { x: 1500 })).toBe(2000);
  });

  it('round(99, -1) = 100', () => {
    expect(ev('round(x, -1)', { x: 99 })).toBe(100);
  });

  it('round with string input from CSV', () => {
    expect(ev('round(x, 2)', { x: '3.14159' })).toBe(3.14);
  });

  it('round non-numeric string returns null', () => {
    expect(ev('round(x)', { x: 'banana' })).toBe(null);
  });
});

// ─── String/date comparison operators (B4) ───────────────────────────────────

describe('comparison operators: string and date support', () => {
  it('"b" > "a" is true (lexicographic)', () => {
    expect(ev('x > y', { x: 'b', y: 'a' })).toBe(true);
  });

  it('"apple" < "banana" is true', () => {
    expect(ev('x < y', { x: 'apple', y: 'banana' })).toBe(true);
  });

  it('date string comparison: "2024-06-15" > "2024-01-01"', () => {
    expect(ev('x > y', { x: '2024-06-15', y: '2024-01-01' })).toBe(true);
  });

  it('date string comparison: "2024-01-01" < "2024-12-31"', () => {
    expect(ev('x < y', { x: '2024-01-01', y: '2024-12-31' })).toBe(true);
  });

  it('numeric strings still compare as numbers: "90" > "9"', () => {
    expect(ev('x > y', { x: '90', y: '9' })).toBe(true);
  });

  it('numeric string vs number: "80" > 50', () => {
    expect(ev('x > 50', { x: '80' })).toBe(true);
  });

  it('equal strings: "abc" >= "abc"', () => {
    expect(ev('x >= y', { x: 'abc', y: 'abc' })).toBe(true);
  });
});

// ─── Strict equality (B5) ────────────────────────────────────────────────────

describe('strict equality (safeEqual)', () => {
  it('0 == "" is false (no longer loose)', () => {
    expect(ev('x == y', { x: 0, y: '' })).toBe(false);
  });

  it('0 == false is false', () => {
    expect(ev('x == y', { x: 0, y: false })).toBe(false);
  });

  it('null == null is true', () => {
    expect(ev('x == y', {})).toBe(true);
  });

  it('"5" == 5 is true (CSV numeric coercion)', () => {
    expect(ev('x == 5', { x: '5' })).toBe(true);
  });

  it('"5" != 5 is false', () => {
    expect(ev('x != 5', { x: '5' })).toBe(false);
  });

  it('"abc" == "abc" is true', () => {
    expect(ev('x == y', { x: 'abc', y: 'abc' })).toBe(true);
  });

  it('"abc" != "def" is true', () => {
    expect(ev('x != y', { x: 'abc', y: 'def' })).toBe(true);
  });

  it('null_if(0, "") does NOT nullify (no longer loose)', () => {
    expect(ev('null_if(x, "")', { x: 0 })).toBe(0);
  });

  it('recode with numeric CSV strings matches number literals', () => {
    expect(ev('recode(x, 1, "one", 2, "two")', { x: '1' })).toBe('one');
  });

  it('in() with numeric CSV strings', () => {
    expect(ev('in(x, 1, 2, 3)', { x: '2' })).toBe(true);
  });
});

// ─── cut() simplification (B3) ──────────────────────────────────────────────

describe('cut() simplified logic', () => {
  it('value at rightmost break is included', () => {
    expect(ev('cut(x, [0, 18, 65, 100], ["youth", "adult", "senior"])', { x: 100 })).toBe('senior');
  });

  it('value at leftmost break is included', () => {
    expect(ev('cut(x, [0, 18, 65, 100], ["youth", "adult", "senior"])', { x: 0 })).toBe('youth');
  });

  it('value between breaks', () => {
    expect(ev('cut(x, [0, 18, 65, 100], ["youth", "adult", "senior"])', { x: 30 })).toBe('adult');
  });

  it('value at inner break goes to next bin', () => {
    expect(ev('cut(x, [0, 18, 65, 100], ["youth", "adult", "senior"])', { x: 18 })).toBe('adult');
  });

  it('value below range returns null', () => {
    expect(ev('cut(x, [10, 20, 30], ["low", "high"])', { x: 5 })).toBe(null);
  });

  it('value above range returns null', () => {
    expect(ev('cut(x, [10, 20, 30], ["low", "high"])', { x: 35 })).toBe(null);
  });

  it('two breaks (single bin)', () => {
    expect(ev('cut(x, [0, 100], ["all"])', { x: 50 })).toBe('all');
  });
});

// ─── Filter type coercion (R7) ──────────────────────────────────────────────

describe('filter type coercion for CSV text columns', () => {
  it('filter string "80" = number 80 matches', () => {
    const rows = [{ score: '80' }, { score: '90' }, { score: '70' }];
    const result = evaluateExpression('score', rows, {
      filter: [{ field: 'score', op: '=', value: 80 }],
    });
    // Only the first row matches
    expect(result.values.filter((v: any) => v !== null)).toEqual(['80']);
  });

  it('filter string "80" > number 75 matches', () => {
    const rows = [{ score: '80' }, { score: '60' }, { score: '90' }];
    const result = evaluateExpression('score', rows, {
      filter: [{ field: 'score', op: '>', value: 75 }],
    });
    expect(result.values.filter((v: any) => v !== null)).toEqual(['80', '90']);
  });

  it('filter between works with string numerics', () => {
    const rows = [{ score: '80' }, { score: '60' }, { score: '90' }];
    const result = evaluateExpression('score', rows, {
      filter: [{ field: 'score', op: 'between', value: [70, 85] }],
    });
    expect(result.values.filter((v: any) => v !== null)).toEqual(['80']);
  });
});

// ─── PartitionBy / filter field validation (R8+R9) ──────────────────────────

describe('partitionBy and filter field validation', () => {
  let db: any, metadata: any, sourceColumns: string[];

  beforeEach(() => {
    ({ db, metadata, sourceColumns } = createTestDb());
  });

  it('rejects invalid partitionBy column', () => {
    expect(() =>
      executeSingleTransform(db, metadata, {
        sourceId: 'test',
        table: 'data',
        create: 'z_score',
        expr: 'score',
        partitionBy: 'nonexistent',
      }, sourceColumns)
    ).toThrow(/Partition column 'nonexistent' not found/);
  });

  it('rejects invalid filter field', () => {
    expect(() =>
      executeSingleTransform(db, metadata, {
        sourceId: 'test',
        table: 'data',
        create: 'filtered',
        expr: 'score * 2',
        filter: [{ field: 'fake_column', op: '=', value: 'X' }],
      }, sourceColumns)
    ).toThrow(/Filter field 'fake_column' not found/);
  });

  it('accepts valid partitionBy column', () => {
    const result = executeSingleTransform(db, metadata, {
      sourceId: 'test',
      table: 'data',
      create: 'z_score',
      expr: 'score',
      partitionBy: 'gender',
    }, sourceColumns);
    expect(result.created.length).toBe(1);
  });
});

// ─── Duplicate batch names (from first round) ──────────────────────────────

describe('duplicate batch transform names', () => {
  let db: any, metadata: any, sourceColumns: string[];

  beforeEach(() => {
    ({ db, metadata, sourceColumns } = createTestDb());
  });

  it('rejects duplicate column names in batch', () => {
    expect(() =>
      executeBatchTransform(db, metadata, {
        sourceId: 'test',
        table: 'data',
        transforms: [
          { create: 'x', expr: 'score + 1' },
          { create: 'x', expr: 'score + 2' },
        ],
      }, sourceColumns)
    ).toThrow(/Duplicate column name 'x'/);
  });
});

// ─── Power operator right-associativity ─────────────────────────────────────

describe('power operator right-associativity', () => {
  it('2^3^2 = 2^(3^2) = 512, not (2^3)^2 = 64', () => {
    expect(ev('2 ^ 3 ^ 2')).toBe(512);
  });

  it('2^2^3 = 2^(2^3) = 256, not (2^2)^3 = 64', () => {
    expect(ev('2 ^ 2 ^ 3')).toBe(256);
  });
});

// ─── String escape sequences (R5) ──────────────────────────────────────────

describe('tokenizer string escapes', () => {
  it('escaped double quote: "O\\"Brien"', () => {
    const tokens = tokenize('"O\\"Brien"');
    expect(tokens[0].value).toBe('O"Brien');
  });

  it('escaped backslash: "a\\\\b"', () => {
    const tokens = tokenize('"a\\\\b"');
    expect(tokens[0].value).toBe('a\\b');
  });

  it('escaped newline: "line1\\nline2"', () => {
    const tokens = tokenize('"line1\\nline2"');
    expect(tokens[0].value).toBe('line1\nline2');
  });

  it('escaped tab: "col1\\tcol2"', () => {
    const tokens = tokenize('"col1\\tcol2"');
    expect(tokens[0].value).toBe('col1\tcol2');
  });

  it('unknown escape passes through: "a\\xb"', () => {
    const tokens = tokenize('"a\\xb"');
    expect(tokens[0].value).toBe('a\\xb');
  });

  it('no escape (plain string still works)', () => {
    const tokens = tokenize('"hello world"');
    expect(tokens[0].value).toBe('hello world');
  });
});

// ─── date_floor edge cases ──────────────────────────────────────────────────

describe('date_floor edge cases', () => {
  it('floors to day', () => {
    expect(ev('date_floor(d, "day")', { d: '2024-06-15T14:30:00Z' })).toBe('2024-06-15');
  });

  it('week floor crossing year boundary: Jan 2 2025 (Thursday) → Dec 29 2024 (Sunday)', () => {
    // Jan 2 2025 is a Thursday (UTC day 4), so floor to Sunday = Dec 29 2024
    const result = ev('date_floor(d, "week")', { d: '2025-01-02' });
    expect(result).toBe('2024-12-29');
  });
});

// ─── Empty string coercion in row aggregation ───────────────────────────────

describe('empty string handling in numeric functions', () => {
  it('row_mean skips empty strings', () => {
    expect(ev('row_mean(a, b, c)', { a: 10, b: '', c: 20 })).toBe(15);
  });

  it('row_sum skips empty strings', () => {
    expect(ev('row_sum(a, b)', { a: 10, b: '' })).toBe(10);
  });

  it('all empty strings returns null', () => {
    expect(ev('row_mean(a, b)', { a: '', b: '' })).toBe(null);
  });
});

// ─── percentile_rank correctness after binary search fix ────────────────────

describe('percentile_rank binary search correctness', () => {
  it('produces same results as linear scan', () => {
    const rows = [
      { x: 10 }, { x: 20 }, { x: 30 }, { x: 40 }, { x: 50 },
    ];
    const result = evaluateExpression('percentile_rank(x)', rows);
    // 10 is smallest: 0 below / 4 = 0
    // 20: 1 below / 4 = 0.25
    // 30: 2 below / 4 = 0.5
    // 40: 3 below / 4 = 0.75
    // 50: 4 below / 4 = 1.0
    expect(result.values).toEqual([0, 0.25, 0.5, 0.75, 1.0]);
  });

  it('handles ties correctly', () => {
    const rows = [{ x: 10 }, { x: 10 }, { x: 20 }, { x: 20 }];
    const result = evaluateExpression('percentile_rank(x)', rows);
    // 10: 0 below / 3 = 0
    // 10: 0 below / 3 = 0
    // 20: 2 below / 3 = 0.667
    // 20: 2 below / 3 = 0.667
    expect(result.values[0]).toBeCloseTo(0, 5);
    expect(result.values[1]).toBeCloseTo(0, 5);
    expect(result.values[2]).toBeCloseTo(2/3, 5);
    expect(result.values[3]).toBeCloseTo(2/3, 5);
  });

  it('single value returns 0', () => {
    const rows = [{ x: 42 }];
    const result = evaluateExpression('percentile_rank(x)', rows);
    expect(result.values).toEqual([0]);
  });
});
