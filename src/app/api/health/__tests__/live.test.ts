interface MockResponse {
  status: number;
  json(): Promise<{ status: string }>;
  headers: Map<string, string>;
}

import { GET } from '../live/route';

describe('liveness API', () => {
  it('returns 200 with status ok', async () => {
    const response = await GET() as unknown as MockResponse;
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  it('sets no-cache headers on the response', async () => {
    const response = await GET() as unknown as MockResponse;
    expect(response.headers.get('Cache-Control')).toBe('no-cache, private, no-store');
  });
});