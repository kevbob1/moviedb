import { GET } from '../route';
import { defaultImportFlow } from '@/lib/import-flow';
import { TmdbError } from '@/lib/tmdb';

jest.mock('@/lib/import-flow', () => ({
  defaultImportFlow: { search: jest.fn() },
}));

const search = defaultImportFlow.search as jest.Mock;
const request = (url: string) => ({ url }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

test('searches movies and tv through the flow', async () => {
  search.mockResolvedValue({ items: [], availability: { configured: true, error: null } });
  expect((await GET(request('http://localhost/api/import/search?q=alien&type=movie'))).status).toBe(200);
  expect((await GET(request('http://localhost/api/import/search?q=dark&type=tv'))).status).toBe(200);
  expect(search).toHaveBeenNthCalledWith(2, 'dark', 'tv');
});

test('maps TMDB errors', async () => {
  search.mockRejectedValue(new TmdbError('TMDB down'));
  const response = await GET(request('http://localhost/api/import/search?q=x&type=movie'));
  expect(response.status).toBe(502);
  await expect(response.json()).resolves.toEqual({ error: 'TMDB down' });
});

test('rejects missing and invalid parameters', async () => {
  expect((await GET(request('http://localhost/api/import/search?q=x'))).status).toBe(400);
  expect((await GET(request('http://localhost/api/import/search?q=x&type=book'))).status).toBe(400);
});
