import {
  HttpTransmissionAdapter,
  InMemoryTransmissionAdapter,
} from '../adapter';

describe('HttpTransmissionAdapter coverage edges', () => {
  let originalUrl: string | undefined;
  let originalUsername: string | undefined;
  let originalPassword: string | undefined;

  beforeEach(() => {
    originalUrl = process.env.TRANSMISSION_URL;
    originalUsername = process.env.TRANSMISSION_USERNAME;
    originalPassword = process.env.TRANSMISSION_PASSWORD;
    delete process.env.TRANSMISSION_URL;
    delete process.env.TRANSMISSION_USERNAME;
    delete process.env.TRANSMISSION_PASSWORD;
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env.TRANSMISSION_URL = originalUrl;
    process.env.TRANSMISSION_USERNAME = originalUsername;
    process.env.TRANSMISSION_PASSWORD = originalPassword;
  });

  it('treats a 200 session handshake as no session id and omits the header', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success', arguments: { torrents: [] } }),
      } as unknown as Response);

    const adapter = new HttpTransmissionAdapter({ url: 'http://transmission.example.com:9091' });
    await expect(adapter.getTorrents()).resolves.toEqual([]);

    const rpcHeaders = (global.fetch as jest.Mock).mock.calls[1][1].headers;
    expect(rpcHeaders).not.toHaveProperty('X-Transmission-Session-Id');
    expect(rpcHeaders).not.toHaveProperty('Authorization');
  });

  it('throws when the session handshake fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      headers: new Map(),
    } as unknown as Response);

    const adapter = new HttpTransmissionAdapter({ url: 'http://transmission.example.com:9091' });
    await expect(adapter.getTorrents()).rejects.toThrow(
      'Transmission session handshake failed: 500 Server Error',
    );
  });

  it('throws when the RPC call itself fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        headers: new Map([['X-Transmission-Session-Id', 'session-1']]),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        headers: new Map(),
      } as unknown as Response);

    const adapter = new HttpTransmissionAdapter({
      url: 'http://transmission.example.com:9091',
      username: 'admin',
      password: 'secret',
    });
    await expect(adapter.getTorrents()).rejects.toThrow(
      'Transmission RPC error: 502 Bad Gateway',
    );
  });

  it('maps sparsely reported torrents to defaults and empty files', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        headers: new Map([['X-Transmission-Session-Id', 'session-1']]),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: 'success',
          arguments: { torrents: [{}, { hashString: 'h', files: [] }] },
        }),
      } as unknown as Response);

    const result = await new HttpTransmissionAdapter({
      url: 'http://transmission.example.com:9091',
    }).getTorrents();

    expect(result).toEqual([
      { hash: '', name: '', percentDone: 0, status: 0 },
      { hash: 'h', name: '', percentDone: 0, status: 0, files: [] },
    ]);
  });
});

describe('InMemoryTransmissionAdapter coverage edges', () => {
  const torrents = [
    { hash: 'a', name: 'A', percentDone: 1, status: 6 },
    { hash: 'b', name: 'B', percentDone: 0, status: 4 },
  ];

  it('reports its seeded ping result', async () => {
    const adapter = new InMemoryTransmissionAdapter({ torrents });
    await expect(adapter.ping()).resolves.toEqual({ configured: true, reachable: true });
  });

  it('returns every torrent, none for an empty selection, and filters a selection', async () => {
    const adapter = new InMemoryTransmissionAdapter({ torrents });

    await expect(adapter.getTorrents()).resolves.toEqual(torrents);
    await expect(adapter.getTorrents([])).resolves.toEqual([]);
    await expect(adapter.getTorrents(['b'])).resolves.toEqual([torrents[1]]);
  });

  it('passes through an explicit not-configured seed', async () => {
    const adapter = new InMemoryTransmissionAdapter({
      ping: { configured: false, reachable: false, error: 'nope' },
    });

    await expect(adapter.ping()).resolves.toEqual({
      configured: false,
      reachable: false,
      error: 'nope',
    });
  });
});
