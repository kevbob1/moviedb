import { GET } from '../route';
const request = (url: string) => ({ url }) as unknown as Request;
import { defaultImportFlow } from '@/lib/import-flow';

jest.mock('@/lib/import-flow', () => ({ defaultImportFlow: { seasonsFor: jest.fn() } }));

test('hydrates seasons through the flow', async () => {
  (defaultImportFlow.seasonsFor as jest.Mock).mockResolvedValue([]);
  expect((await GET(request('http://localhost/api/import/seasons?id=2'))).status).toBe(200);
  expect(defaultImportFlow.seasonsFor).toHaveBeenCalledWith(2);
});
