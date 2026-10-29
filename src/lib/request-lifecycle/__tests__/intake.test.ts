import type { TmdbClient } from '@/lib/tmdb';

import { makeInMemoryDrizzle } from '../../../test-support/fake-drizzle';
import {
  fixedNow,
  makeService,
  recordingEnqueueJob,
} from '../../../test-support/request-service-fake';
import { createRequestService } from '../repository';

describe('request-lifecycle/intake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a request and enqueues a notification job atomically', async () => {
      const fake = makeInMemoryDrizzle();
      const { service, enqueueJob, store } = makeService(fake);

      const result = await service.createRequest({
        tmdbId: 123,
        title: 'Test Movie',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Movie');
      expect(result.status).toBe('pending');
      expect(store.transactions).toBe(1);
      expect(enqueueJob).toHaveBeenCalledTimes(1);
      expect((enqueueJob as jest.Mock).mock.calls[0][1]).toBe('request_notification');
      expect(store.requests).toHaveLength(1);
    });

    it('returns the existing row without enqueuing when a duplicate exists', async () => {
      const fake = makeInMemoryDrizzle();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();
      const service = createRequestService({
        db: fake.db,
        enqueueJob,
        now: fixedNow,
      });

      await service.createRequest({
        tmdbId: 123,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      calls.length = 0;

      const result = await service.createRequest({
        tmdbId: 123,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Bob',
        mediaType: 'movie',
      });

      expect(result.id).toBe(1);
      expect(calls).toHaveLength(0);
      expect(fake.store.transactions).toBe(1);
    });

    it('treats a movie and a season-zero request as different requests', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await service.createRequest({
        tmdbId: 123,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'movie',
      });

      const season = await service.createRequest({
        tmdbId: 123,
        title: 'Test',
        posterPath: null,
        requestedBy: 'Alice',
        mediaType: 'tv',
        seasonNumber: 0,
      });

      expect(season.id).toBe(2);
    });

    it('throws when title is missing', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await expect(
        service.createRequest({
          tmdbId: 1,
          title: '',
          posterPath: null,
          requestedBy: 'Alice',
          mediaType: 'movie',
        }),
      ).rejects.toThrow('Title is required');
    });

    it('throws when requestedBy is missing', async () => {
      const fake = makeInMemoryDrizzle();
      const { service } = makeService(fake);

      await expect(
        service.createRequest({
          tmdbId: 1,
          title: 'Test',
          posterPath: null,
          requestedBy: '',
          mediaType: 'movie',
        }),
      ).rejects.toThrow('Requester name is required');
    });
  });

  describe('createTvRequests', () => {
    it('creates TV season requests and enqueues a tv_series_request_notification job', async () => {
      const fake = makeInMemoryDrizzle();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();

      const tmdb: TmdbClient = {
        searchMovies: jest.fn(),
        searchTV: jest.fn(),
        tvDetails: jest.fn().mockResolvedValue({
          id: 100,
          name: 'Best Show',
          first_air_date: '2022-01-01',
          poster_path: '/best.jpg',
          seasons: [
            { season_number: 0, name: 'Specials', episode_count: 5 },
            { season_number: 1, name: 'Season 1', episode_count: 10 },
            { season_number: 2, name: 'Season 2', episode_count: 8 },
          ],
        }),
      };

      const service = createRequestService({
        db: fake.db,
        enqueueJob,
        now: fixedNow,
        tmdb,
      });

      const results = await service.createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('tv_series_request_notification');
      expect(fake.store.requests.map((row) => row.season_number)).toEqual([1, 2]);
    });

    it('reuses an already-requested season instead of inserting it twice', async () => {
      const fake = makeInMemoryDrizzle({
        requests: [
          {
            tmdbId: 100,
            title: 'Best Show',
            posterPath: null,
            requestedBy: 'Bob',
            mediaType: 'tv',
            seasonNumber: 1,
          },
        ],
      });
      const { service } = makeService(fake, {
        tmdb: {
          searchMovies: jest.fn(),
          searchTV: jest.fn(),
          tvDetails: jest.fn().mockResolvedValue({
            id: 100,
            name: 'Best Show',
            first_air_date: '2022-01-01',
            poster_path: '/best.jpg',
            seasons: [
              { season_number: 1, name: 'Season 1', episode_count: 10 },
              { season_number: 2, name: 'Season 2', episode_count: 8 },
            ],
          }),
        } as unknown as TmdbClient,
      });

      const results = await service.createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
      expect(fake.store.requests).toHaveLength(2);
      expect(fake.store.requests[0].requested_by).toBe('Bob');
    });
  });
});
