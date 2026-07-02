import { HttpJellyfinAdapter } from '../adapter';

describe('HttpJellyfinAdapter', () => {
  let originalUrl: string | undefined;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalUrl = process.env.JELLYFIN_URL;
    originalApiKey = process.env.JELLYFIN_API_KEY;
    process.env.JELLYFIN_URL = 'http://localhost:8096';
    process.env.JELLYFIN_API_KEY = 'test-key';
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    process.env.JELLYFIN_URL = originalUrl;
    process.env.JELLYFIN_API_KEY = originalApiKey;
  });

  describe('fetchCatalog', () => {
    it('returns empty data with error when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.fetchCatalog();
      expect(result.movies.size).toBe(0);
      expect(result.seasons.size).toBe(0);
      expect(result.error).toBe('Jellyfin not configured');
    });

    it('returns empty data with error when JELLYFIN_API_KEY is missing', async () => {
      delete process.env.JELLYFIN_API_KEY;
      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.fetchCatalog();
      expect(result.error).toBe('Jellyfin not configured');
    });

    it('paginates when TotalRecordCount exceeds limit', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Items: Array.from({ length: 500 }, (_, i) => ({ ProviderIds: { Tmdb: String(i) } })),
            TotalRecordCount: 750,
          }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Items: Array.from({ length: 250 }, (_, i) => ({ ProviderIds: { Tmdb: String(500 + i) } })),
            TotalRecordCount: 750,
          }),
        } as unknown as Response);

      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.fetchCatalog();
      expect(result.movies.size).toBe(750);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('returns error when Jellyfin returns non-OK response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as unknown as Response);

      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.fetchCatalog();
      expect(result.error).toContain('Jellyfin API error: 401');
    });

    it('returns error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.fetchCatalog();
      expect(result.error).toContain('Jellyfin connection failed: Network error');
    });

    it('requests Series items so TV shows are detected', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Items: [], TotalRecordCount: 0 }),
      } as unknown as Response);

      const adapter = new HttpJellyfinAdapter();
      await adapter.fetchCatalog();
      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('IncludeItemTypes=Movie,Season,Series');
    });

    it('captures season IndexNumber per TMDB id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Items: [
            { ProviderIds: { Tmdb: '100' }, IndexNumber: 1 },
            { ProviderIds: { Tmdb: '100' }, IndexNumber: 2 },
            { ProviderIds: { Tmdb: '200' }, IndexNumber: 1 },
          ],
          TotalRecordCount: 3,
        }),
      } as unknown as Response);

      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.fetchCatalog();
      expect(result.movies.has('100')).toBe(true);
      expect(result.movies.has('200')).toBe(true);
      expect(Array.from(result.seasons.get('100')!)).toEqual([1, 2]);
      expect(Array.from(result.seasons.get('200')!)).toEqual([1]);
    });
  });

  describe('ping', () => {
    it('returns not configured when JELLYFIN_URL is missing', async () => {
      delete process.env.JELLYFIN_URL;
      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: false, error: 'Jellyfin not configured' });
    });

    it('returns reachable on 200 from /System/Info', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ServerName: 'TestServer' }),
      } as unknown as Response);

      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: true });
    });

    it('returns not reachable on non-OK', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      } as unknown as Response);

      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.ping();
      expect(result.reachable).toBe(false);
      expect(result.error).toContain('Jellyfin API error: 500');
    });

    it('returns not reachable on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));
      const adapter = new HttpJellyfinAdapter();
      const result = await adapter.ping();
      expect(result.reachable).toBe(false);
      expect(result.error).toContain('Jellyfin connection failed: Connection refused');
    });

    it('uses explicit url and apiKey when provided', async () => {
      delete process.env.JELLYFIN_URL;
      delete process.env.JELLYFIN_API_KEY;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ServerName: 'ExplicitServer' }),
      } as unknown as Response);

      const adapter = new HttpJellyfinAdapter({
        url: 'http://jellyfin.example.com',
        apiKey: 'explicit-key',
      });
      const result = await adapter.ping();
      expect(result).toEqual({ reachable: true });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://jellyfin.example.com/System/Info',
        expect.objectContaining({
          headers: { Authorization: 'MediaBrowser Token="explicit-key"' },
        })
      );
    });
  });
});
