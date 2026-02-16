/**
 * Operation log — ring buffer of recent tool calls for bug reports.
 * Captures sanitized metadata (patterns, data shapes, DSL structure)
 * but never data values, connection strings, or file paths.
 */

export interface OperationMeta {
  pattern?: string;
  specId?: string;
  alternativesCount?: number;
  dataShape?: { rowCount: number; columnCount: number; columns: { name: string; type: string }[] };
  dslStructure?: DslStructure;
  sourceType?: string;
  error?: string;
  viewCount?: number;
  filterCount?: number;
  changes?: string[];
}

export interface DslStructure {
  hasJoin: boolean;
  hasFilter: boolean;
  hasGroupBy: boolean;
  hasHaving: boolean;
  hasOrderBy: boolean;
  hasLimit: boolean;
  aggregates: string[];
  windows: string[];
}

export interface OperationEntry {
  toolName: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  meta: OperationMeta;
}

const MAX_ENTRIES = 10;

const EMPTY_DSL_STRUCTURE: DslStructure = {
  hasJoin: false, hasFilter: false, hasGroupBy: false,
  hasHaving: false, hasOrderBy: false, hasLimit: false,
  aggregates: [], windows: [],
};

export class OperationLog {
  private entries: OperationEntry[] = [];

  log(entry: OperationEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }
  }

  getAll(): OperationEntry[] {
    return [...this.entries].reverse();
  }

  getLast(): OperationEntry | undefined {
    return this.entries.at(-1);
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}

export function extractDslStructure(query: unknown): DslStructure {
  if (!query || typeof query !== 'object') {
    return { ...EMPTY_DSL_STRUCTURE, aggregates: [], windows: [] };
  }

  const q = query as Record<string, unknown>;
  const aggregates: string[] = [];
  const windows: string[] = [];

  if (Array.isArray(q.select)) {
    for (const field of q.select) {
      if (field && typeof field === 'object') {
        const f = field as Record<string, unknown>;
        if (f.aggregate && typeof f.aggregate === 'string') aggregates.push(f.aggregate);
        if (f.window && typeof f.window === 'string') windows.push(f.window);
      }
    }
  }

  return {
    hasJoin: Array.isArray(q.join) && q.join.length > 0,
    hasFilter: Array.isArray(q.filter) && q.filter.length > 0,
    hasGroupBy: Array.isArray(q.groupBy) && q.groupBy.length > 0,
    hasHaving: Array.isArray(q.having) && q.having.length > 0,
    hasOrderBy: Array.isArray(q.orderBy) && q.orderBy.length > 0,
    hasLimit: q.limit != null,
    aggregates: [...new Set(aggregates)],
    windows: [...new Set(windows)],
  };
}

export const operationLog = new OperationLog();

/** Log an operation, silently ignoring errors so logging never breaks tool handlers. */
export function logOperation(entry: OperationEntry): void {
  try { operationLog.log(entry); } catch {}
}
