import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { errorResponse } from './shared.js';
import { handleAddSource, isSandboxPath } from './sources.js';

export const connectDataInputSchema = z.object({
  path: z.string().optional().describe('File or directory path. If omitted, Dolex will ask the user directly.'),
});

function detectType(filePath: string): 'csv' | 'sqlite' {
  const stat = fs.statSync(filePath, { throwIfNoEntry: false });
  if (!stat) return 'csv';

  if (stat.isDirectory()) {
    const files = fs.readdirSync(filePath);
    if (files.some(f => f.endsWith('.sqlite') || f.endsWith('.db') || f.endsWith('.sqlite3'))) return 'sqlite';
    return 'csv';
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.sqlite' || ext === '.db' || ext === '.sqlite3') return 'sqlite';
  return 'csv';
}

function deriveName(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function handleConnectData(deps: { sourceManager: any; server: McpServer }) {
  const addSource = handleAddSource({ sourceManager: deps.sourceManager });

  return async (args: z.infer<typeof connectDataInputSchema>, _extra: any) => {
    let filePath = args.path;

    if (!filePath) {
      try {
        const result = await deps.server.server.elicitInput({
          message: 'What data would you like to analyze?',
          requestedSchema: {
            type: 'object' as const,
            properties: {
              path: {
                type: 'string' as const,
                title: 'File or directory path',
                description: 'e.g. /Users/you/Downloads/sales.csv or ~/data/my-project/',
              },
            },
            required: ['path'],
          },
        });

        if (result.action !== 'accept' || !result.content?.path) {
          return errorResponse('No path provided. To connect data, provide a file or directory path.');
        }
        filePath = result.content.path as string;
      } catch {
        return errorResponse(
          'This client does not support interactive input. '
          + 'Use add_source instead and pass the file path directly.'
        );
      }
    }

    filePath = filePath.replace(/^~/, process.env.HOME || '');

    if (isSandboxPath(filePath)) {
      return errorResponse(
        'This path looks like a cloud sandbox path, not a local filesystem path. '
        + 'Dolex runs on the user\'s machine and can access any local file — but not cloud sandbox uploads. '
        + 'Please provide the real local path.'
      );
    }

    const stat = fs.statSync(filePath, { throwIfNoEntry: false });
    if (!stat) {
      return errorResponse(`Path not found: ${filePath}`);
    }

    const type = detectType(filePath);
    const name = deriveName(filePath);

    return addSource({
      name,
      type,
      config: { type, path: filePath } as any,
      detail: 'full',
    });
  };
}
