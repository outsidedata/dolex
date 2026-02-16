import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleConnectData } from '../../src/mcp/tools/connect-data.js';
import * as fs from 'fs';

vi.mock('fs');

function makeMockManager(overrides: Record<string, any> = {}) {
  return {
    get: vi.fn().mockReturnValue(null),
    add: vi.fn().mockResolvedValue({
      ok: true,
      entry: { id: 'src-abc', name: 'Test', type: 'csv' },
    }),
    getSchema: vi.fn().mockResolvedValue({
      ok: true,
      schema: {
        tables: [{
          name: 'data',
          rowCount: 100,
          columns: [
            { name: 'id', type: 'numeric', nullCount: 0, uniqueCount: 100 },
            { name: 'name', type: 'categorical', nullCount: 0, uniqueCount: 50 },
          ],
        }],
      },
    }),
    connect: vi.fn().mockResolvedValue({
      ok: true,
      source: { getSampleRows: vi.fn().mockResolvedValue([]) },
    }),
    ...overrides,
  };
}

function makeMockServer(elicitResult?: any) {
  return {
    server: {
      elicitInput: elicitResult
        ? vi.fn().mockResolvedValue(elicitResult)
        : vi.fn().mockRejectedValue(new Error('Elicitation not supported')),
    },
  } as any;
}

describe('handleConnectData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses elicitation when no path provided', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer({
      action: 'accept',
      content: { path: '/Users/bill/data/sales.csv' },
    });

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    const result = await handler({}, {});

    expect(mockServer.server.elicitInput).toHaveBeenCalled();
    expect(manager.add).toHaveBeenCalledWith(
      'Sales',
      expect.objectContaining({ type: 'csv', path: '/Users/bill/data/sales.csv' }),
    );
    expect(result.isError).toBeUndefined();
  });

  it('skips elicitation when path is provided', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    const result = await handler({ path: '/Users/bill/data.csv' }, {});

    expect(mockServer.server.elicitInput).not.toHaveBeenCalled();
    expect(manager.add).toHaveBeenCalled();
  });

  it('returns error when user cancels elicitation', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer({ action: 'cancel' });

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    const result = await handler({}, {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('No path provided');
  });

  it('falls back gracefully when client does not support elicitation', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    const result = await handler({}, {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('does not support interactive input');
  });

  it('detects CSV type from file extension', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    await handler({ path: '/data/report.csv' }, {});

    expect(manager.add).toHaveBeenCalledWith(
      'Report',
      expect.objectContaining({ type: 'csv' }),
    );
  });

  it('detects SQLite type from file extension', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    await handler({ path: '/data/app.sqlite' }, {});

    expect(manager.add).toHaveBeenCalledWith(
      'App',
      expect.objectContaining({ type: 'sqlite' }),
    );
  });

  it('defaults to CSV for directories with CSV files', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdirSync).mockReturnValue([
      'sales.csv', 'orders.csv', 'readme.txt',
    ] as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    await handler({ path: '/data/my-project/' }, {});

    expect(manager.add).toHaveBeenCalledWith(
      'My Project',
      expect.objectContaining({ type: 'csv', path: '/data/my-project/' }),
    );
  });

  it('detects SQLite in directory when .sqlite file present', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as any);
    vi.mocked(fs.readdirSync).mockReturnValue([
      'app.sqlite', 'readme.txt',
    ] as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    await handler({ path: '/data/mydb/' }, {});

    expect(manager.add).toHaveBeenCalledWith(
      'Mydb',
      expect.objectContaining({ type: 'sqlite' }),
    );
  });

  it('returns error for nonexistent path', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue(undefined as any);

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    const result = await handler({ path: '/nope/nothing.csv' }, {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('Path not found');
  });

  it('rejects sandbox paths', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    const result = await handler({ path: '/mnt/user-data/uploads/file.csv' }, {});

    expect(result.isError).toBe(true);
    const body = JSON.parse(result.content[0].text);
    expect(body.error).toContain('cloud sandbox');
  });

  it('expands tilde in paths', async () => {
    const manager = makeMockManager();
    const mockServer = makeMockServer();

    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);

    const originalHome = process.env.HOME;
    process.env.HOME = '/Users/testuser';

    const handler = handleConnectData({ sourceManager: manager, server: mockServer });
    await handler({ path: '~/data/sales.csv' }, {});

    expect(manager.add).toHaveBeenCalledWith(
      'Sales',
      expect.objectContaining({ path: '/Users/testuser/data/sales.csv' }),
    );

    process.env.HOME = originalHome;
  });
});
