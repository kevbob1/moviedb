import type { TmdbClient } from '@/lib/tmdb';

import {
  asPrisma,
  fixedNow,
  makeFakePrisma,
  recordingEnqueueJob,
} from './fake-prisma';
import { createRequestService } from '../repository';

describe('request-lifecycle/intake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('creates a request and enqueues a notification job atomically', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: asPrisma(fake),
        enqueueJob,
        now: fixedNow,
      });

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
      expect(fake.$transaction).toHaveBeenCalledTimes(1);
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('request_notification');
    });

    it('returns the existing row without enqueuing when a duplicate exists', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob, calls } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: asPrisma(fake),
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
      expect(fake.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws when title is missing', async () => {
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: asPrisma(fake),
        enqueueJob,
        now: fixedNow,
      });

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
      const fake = makeFakePrisma();
      const { fn: enqueueJob } = recordingEnqueueJob();
      const service = createRequestService({
        prisma: asPrisma(fake),
        enqueueJob,
        now: fixedNow,
      });

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
      const fake = makeFakePrisma();
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
        prisma: asPrisma(fake),
        enqueueJob,
        now: fixedNow,
        tmdb,
      });

      const results = await service.createTvRequests(100, 'Alice');

      expect(results).toHaveLength(2);
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('tv_series_request_notification');
    });
  });
});