import { makeInMemoryDrizzle } from '../../../test-support/fake-drizzle';
import { makeService } from '../../../test-support/request-service-fake';
import { InvalidTransitionError } from '../fsm';

const seedRequest = async (fake: ReturnType<typeof makeInMemoryDrizzle>) => {
  const { service } = makeService(fake);
  await service.createRequest({
    tmdbId: 1,
    title: 'Test',
    posterPath: null,
    requestedBy: 'Alice',
    mediaType: 'movie',
  });
};

describe('request-lifecycle/lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('downloadRequest', () => {
    it('writes the status change and clears torrent_problem and suggestion fields', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      fake.store.requests[0].torrent_problem = 'some problem';
      fake.store.requests[0].suggestion_hash = 'old-hash';
      fake.store.requests[0].suggestion_score = 0.95;
      fake.store.requests[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      await service.downloadRequest(1);

      expect(fake.store.requests[0].status).toBe('downloading');
      expect(fake.store.requests[0].torrent_problem).toBeNull();
      expect(fake.store.requests[0].suggestion_hash).toBeNull();
      expect(fake.store.requests[0].suggestion_score).toBeNull();
      expect(fake.store.requests[0].suggestion_computed_at).toBeNull();
    });

    it('throws for an unknown request', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await expect(service.downloadRequest(999)).rejects.toThrow('Request not found');
    });

    it('throws InvalidTransitionError on a disallowed transition', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      await service.fulfillRequest(1);

      await expect(service.downloadRequest(1)).rejects.toBeInstanceOf(InvalidTransitionError);
    });
  });

  describe('fulfillRequest', () => {
    it('sets resolved_at on fulfill and clears suggestion fields', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      await service.downloadRequest(1);
      fake.store.requests[0].suggestion_hash = 'old-hash';
      fake.store.requests[0].suggestion_score = 0.95;
      fake.store.requests[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      const result = await service.fulfillRequest(1);

      expect(result.status).toBe('fulfilled');
      expect((fake.store.requests[0].resolved_at as Date | null)?.toISOString()).toBe('2026-06-15T12:00:00.000Z');
      expect(fake.store.requests[0].suggestion_hash).toBeNull();
      expect(fake.store.requests[0].suggestion_score).toBeNull();
      expect(fake.store.requests[0].suggestion_computed_at).toBeNull();
    });
  });

  describe('linkTorrent', () => {
    it('transitions pending → downloading with hash set and clears suggestion fields', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      fake.store.requests[0].suggestion_hash = 'old-hash';
      fake.store.requests[0].suggestion_score = 0.95;
      fake.store.requests[0].suggestion_computed_at = new Date('2026-01-01T00:00:00Z');

      const result = await service.linkTorrent(1, 'abc123');

      expect(result.status).toBe('downloading');
      expect(fake.store.requests[0].torrent_hash).toBe('abc123');
      expect(fake.store.requests[0].suggestion_hash).toBeNull();
      expect(fake.store.requests[0].suggestion_score).toBeNull();
      expect(fake.store.requests[0].suggestion_computed_at).toBeNull();
    });

    it('rejects if request is not pending', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      await service.downloadRequest(1);

      await expect(service.linkTorrent(1, 'abc123')).rejects.toBeInstanceOf(InvalidTransitionError);
    });

    it('runs inside a transaction so the hash write is atomic with the transition', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      const before = fake.store.transactions;

      await service.linkTorrent(1, 'abc123');

      expect(fake.store.transactions).toBe(before + 1);
    });

    it('leaves the row untouched when the transaction fails', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);
      fake.store.failNextWrite(new Error('update failed'));

      await expect(service.linkTorrent(1, 'abc123')).rejects.toThrow('update failed');
      expect(fake.store.requests[0].status).toBe('pending');
      expect(fake.store.requests[0].torrent_hash).toBeNull();
    });
  });

  describe('cancelRequest', () => {
    it('deletes the row', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await seedRequest(fake);

      await service.cancelRequest(1);

      expect(fake.store.requests).toHaveLength(0);
    });
  });
});
