/**
 * Operation log — ring buffer of recent tool calls for bug reports.
 * Captures sanitized metadata (patterns, data shapes, SQL previews)
 * but never data values, connection strings, or file paths.
 */

export interface OperationMeta {
  pattern?: string;
  specId?: string;
  alternativesCount?: number;
  dataShape?: { rowCount: number; columnCount: number; columns: { name: string; type: string }[] };
  sqlPreview?: string;
  sourceType?: string;
  error?: string;
  viewCount?: number;
  filterCount?: number;
  changes?: string[];
}

export interface OperationEntry {
  toolName: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  meta: OperationMeta;
}

const MAX_ENTRIES = 10;

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

export const operationLog = new OperationLog();

/** Log an operation, silently ignoring errors so logging never breaks tool handlers. */
export function logOperation(entry: OperationEntry): void {
  try { operationLog.log(entry); } catch {}
}
