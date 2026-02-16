import type { DataColumn } from '../types.js';
import type { ClassifiedColumn, ColumnRole } from './types.js';

const STRONG_ID_NAME = /(?:^id$|_id$|_pk$)/;
const WEAK_ID_NAME = /(?:_number$|_no$|_num$|_idx$|_index$|^index$|_key$|_code$|^#$)/;

function looksLikeNumericId(col: DataColumn): boolean {
  const name = col.name.toLowerCase().replace(/[\s.\-]/g, '_');
  const highCardinality = col.totalCount > 0 && col.uniqueCount / col.totalCount > 0.5;
  return STRONG_ID_NAME.test(name) || (WEAK_ID_NAME.test(name) && highCardinality);
}

function classifySingle(col: DataColumn): ColumnRole {
  switch (col.type) {
    case 'id':
      return 'id';
    case 'text':
      return 'text';
    case 'date':
      return 'time';
    case 'numeric':
      if (col.totalCount > 0 && col.uniqueCount >= col.totalCount) return 'id';
      if (looksLikeNumericId(col)) return 'id';
      return 'measure';
    case 'categorical': {
      if (col.totalCount > 0 && col.uniqueCount / col.totalCount >= 0.8) return 'text';
      if (col.uniqueCount <= 50) return 'dimension';
      return 'text';
    }
  }
}

function toClassified(col: DataColumn, role: ColumnRole): ClassifiedColumn {
  return {
    name: col.name,
    originalType: col.type,
    role,
    uniqueCount: col.uniqueCount,
    nullCount: col.nullCount,
    totalCount: col.totalCount,
    ...(col.stats && { stats: col.stats }),
    ...(col.topValues && { topValues: col.topValues }),
  };
}

export function classifyColumns(columns: DataColumn[]): ClassifiedColumn[] {
  const classified = columns.map(c => toClassified(c, classifySingle(c)));

  // Detect hierarchies among dimensions: if one dimension has >2x the unique count
  // of another, the higher-cardinality one is a hierarchy level.
  const dimensions = classified.filter(c => c.role === 'dimension');
  if (dimensions.length >= 2) {
    const sorted = [...dimensions].sort((a, b) => a.uniqueCount - b.uniqueCount);
    for (let i = 1; i < sorted.length; i++) {
      const lower = sorted[i - 1];
      const current = sorted[i];
      if (current.uniqueCount > 2 * lower.uniqueCount) {
        current.role = 'hierarchy';
      }
    }
  }

  return classified;
}
