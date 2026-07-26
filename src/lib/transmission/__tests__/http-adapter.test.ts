import { HttpTransmissionAdapter } from '../adapter';

describe('HttpTransmissionAdapter', () => {
  let originalUrl: string | undefined;
  let originalUsername: string | undefined;
  let originalPassword: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalUrl = process.env.TRANSMISSION_URL;
    originalUsername = process.env.TRANSMISSION_USERNAME;
    originalPassword = process.env.TRANSMISSION_PASSWORD;
    process.env.TRANSMISSION_URL = 'http://localhost:9091';
    process.env.TRANSMISSION_USERNAME = 'admin';
    process.env.TRANSMISSION_PASSWORD = 'password';
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env.TRANSMISSION_URL = originalUrl;
    process.env.TRANSMISSION_USERNAME = originalUsername;
    process.env.TRANSMISSION_PASSWORD = originalPassword;
  });

  describe('ping', () => {
    it('returns not configured when TRANSMISSION_URL is missing', async () => {
      delete process.env.TRANSMISSION_URL;
      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: false, error: 'Transmission not configured' });
    });

    it('returns reachable on 409 from RPC endpoint (session handshake)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 409,
        statusText: 'Conflict',
        headers: new Map([['X-Transmission-Session-Id', 'test-session']]),
      } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: true });
    });

    it('returns reachable on 401 from RPC endpoint (auth required)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['WWW-Authenticate', 'Basic realm="Transmission"']]),
      } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: true });
    });

    it('returns not reachable on 500 from RPC endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 500,
        statusText: 'Server Error',
        headers: new Map(),
      } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.ping();
      expect(result.reachable).toBe(false);
      expect(result.error).toContain('Transmission API error: 500');
    });

    it('returns not reachable on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.ping();
      expect(result.reachable).toBe(false);
      expect(result.error).toContain('Transmission connection failed: Connection refused');
    });

    it('POSTs to the RPC endpoint with the base url and includes auth', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 409,
        statusText: 'Conflict',
        headers: new Map([['X-Transmission-Session-Id', 'sess']]),
      } as unknown as Response);

      const adapter = new HttpTransmissionAdapter({
        url: 'http://transmission.example.com:9091',
      });
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://transmission.example.com:9091/transmission/rpc',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': expect.stringMatching(/^Basic /),
          }),
        })
      );
    });
  });

  describe('getAll', () => {
    it('returns empty array when TRANSMISSION_URL is missing', async () => {
      delete process.env.TRANSMISSION_URL;
      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.getAll();
      expect(result).toEqual([]);
    });

    it('returns torrents from Transmission RPC', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          headers: new Map([['X-Transmission-Session-Id', 'session-123']]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            result: 'success',
            arguments: {
              torrents: [
                { hashString: 'abc123', name: 'Test Movie', percentDone: 1, status: 6, errorString: undefined },
                { hashString: 'def456', name: 'Test TV Show', percentDone: 0.5, status: 4, errorString: undefined },
              ],
            },
          }),
        } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.getAll();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ hash: 'abc123', name: 'Test Movie', percentDone: 1, status: 6 });
      expect(result[1]).toEqual({ hash: 'def456', name: 'Test TV Show', percentDone: 0.5, status: 4 });
    });

    it('handles empty torrent list', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          headers: new Map([['X-Transmission-Session-Id', 'session-123']]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            result: 'success',
            arguments: { torrents: [] },
          }),
        } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.getAll();
      expect(result).toEqual([]);
    });

    it('re-sends session id on 409 retry', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          headers: new Map([['X-Transmission-Session-Id', 'session-123']]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          headers: new Map([['X-Transmission-Session-Id', 'session-456']]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          headers: new Map([['X-Transmission-Session-Id', 'session-789']]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            result: 'success',
            arguments: {
              torrents: [
                { hashString: 'abc123', name: 'Test', percentDone: 1, status: 6 },
              ],
            },
          }),
        } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.getAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('getTorrents', () => {
    it('returns filtered torrents by hashes', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 409,
          statusText: 'Conflict',
          headers: new Map([['X-Transmission-Session-Id', 'session-123']]),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            result: 'success',
            arguments: {
              torrents: [
                { hashString: 'abc123', name: 'Only This', percentDone: 1, status: 6 },
              ],
            },
          }),
        } as unknown as Response);

      const adapter = new HttpTransmissionAdapter();
      const result = await adapter.getTorrents(['abc123']);
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('abc123');
    });
  });
});
