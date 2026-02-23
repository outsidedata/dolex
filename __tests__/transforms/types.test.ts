import { describe, it, expect } from 'vitest';
import { manifestSchema } from '../../src/transforms/types.js';

describe('Manifest Schema', () => {
  it('accepts a valid manifest', () => {
    const valid = {
      version: 1,
      tables: {
        data: [
          { column: 'score_z', expr: 'zscore(score)', type: 'numeric' },
          { column: 'age_group', expr: 'cut(age, [0, 18, 65, 100])', type: 'categorical', partitionBy: 'condition' },
        ],
      },
    };
    const result = manifestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const invalid = {
      tables: {
        data: [{ column: 'x', expr: 'a + b', type: 'numeric' }],
      },
    };
    const result = manifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid type value', () => {
    const invalid = {
      version: 1,
      tables: {
        data: [{ column: 'x', expr: 'a + b', type: 'integer' }],
      },
    };
    const result = manifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing column', () => {
    const invalid = {
      version: 1,
      tables: {
        data: [{ expr: 'a + b', type: 'numeric' }],
      },
    };
    const result = manifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing expr', () => {
    const invalid = {
      version: 1,
      tables: {
        data: [{ column: 'x', type: 'numeric' }],
      },
    };
    const result = manifestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
