import { requestImport } from '../request-actions';
import { defaultImportFlow } from '@/lib/import-flow';

jest.mock('@/lib/import-flow', () => ({ defaultImportFlow: { requestImport: jest.fn() } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

test('delegates requestImport and revalidates affected pages', async () => {
  const result = { id: 1, mediaType: 'movie' as const, title: 'Movie', onJellyfin: false, availableSeasons: [], missingSeasons: [] };
  (defaultImportFlow.requestImport as jest.Mock).mockResolvedValue(result);
  await expect(requestImport(result, 'all', 'Ada')).resolves.toBe(result);
  expect(defaultImportFlow.requestImport).toHaveBeenCalledWith(result, 'all', 'Ada');
});
