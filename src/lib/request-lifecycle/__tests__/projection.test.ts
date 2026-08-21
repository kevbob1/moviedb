import {
  STATUS_CONFIG,
  actionToButtonVariant,
  canCancel,
  getAvailableActions,
  statusToPill,
  toRequestModel,
} from '../projection';

describe('request-lifecycle/projection', () => {
  describe('STATUS_CONFIG', () => {
    it('includes config for all statuses', () => {
      (['pending', 'downloading', 'fulfilled'] as const).forEach((status) => {
        expect(STATUS_CONFIG[status]).toBeDefined();
        expect(STATUS_CONFIG[status]).toHaveProperty('label');
        expect(STATUS_CONFIG[status]).toHaveProperty('color');
        expect(STATUS_CONFIG[status]).toHaveProperty('bgColor');
      });
    });
  });

  describe('statusToPill', () => {
    it('returns the status verbatim', () => {
      expect(statusToPill('pending')).toBe('pending');
      expect(statusToPill('downloading')).toBe('downloading');
      expect(statusToPill('fulfilled')).toBe('fulfilled');
    });
  });

  describe('actionToButtonVariant', () => {
    it('maps download to primary', () => {
      expect(actionToButtonVariant('download')).toBe('primary');
    });

    it('maps fulfill to success', () => {
      expect(actionToButtonVariant('fulfill')).toBe('success');
    });
  });

  describe('getAvailableActions', () => {
    it('returns download and fulfill for pending', () => {
      const actions = getAvailableActions('pending');
      expect(actions.map((a) => a.action)).toEqual(['download', 'fulfill']);
      expect(actions.map((a) => a.label)).toEqual(['Start Download', 'Mark Fulfilled']);
    });

    it('returns fulfill only for downloading', () => {
      const actions = getAvailableActions('downloading');
      expect(actions.map((a) => a.action)).toEqual(['fulfill']);
    });

    it('returns empty for fulfilled', () => {
      expect(getAvailableActions('fulfilled')).toEqual([]);
    });
  });

  describe('canCancel', () => {
    it('allows cancel for pending', () => {
      expect(canCancel('pending')).toBe(true);
    });

    it('allows cancel for downloading', () => {
      expect(canCancel('downloading')).toBe(true);
    });

    it('blocks cancel for fulfilled', () => {
      expect(canCancel('fulfilled')).toBe(false);
    });
  });

  describe('toRequestModel', () => {
    it('maps Prisma row to UI Request shape', () => {
      const requestedAt = new Date('2023-06-01T00:00:00Z');
      const row = {
        id: 1,
        title: 'Test',
        tmdb_id: 123,
        poster_path: '/test.jpg',
        overview: 'An overview',
        release_date: '2023-01-01',
        genre_ids: [28],
        requested_by: 'Alice',
        requested_at: requestedAt,
        status: 'pending',
        season_number: null,
        media_type: 'movie',
        torrent_hash: null,
        torrent_problem: null,
        resolved_at: null,
      };

      const model = toRequestModel(row);

      expect(model).toEqual({
        id: 1,
        title: 'Test',
        tmdb_id: 123,
        poster_path: '/test.jpg',
        overview: 'An overview',
        release_date: '2023-01-01',
        genre_ids: [28],
        requested_by: 'Alice',
        requested_at: '2023-06-01T00:00:00.000Z',
        status: 'pending',
        season_number: undefined,
        media_type: 'movie',
        torrent_hash: null,
        torrent_problem: undefined,
        resolved_at: null,
      });
    });

    it('serializes resolved_at as ISO string', () => {
      const row = {
        id: 1,
        title: 'Test',
        tmdb_id: 123,
        poster_path: null,
        overview: null,
        release_date: null,
        genre_ids: [],
        requested_by: 'Alice',
        requested_at: new Date('2023-06-01T00:00:00Z'),
        status: 'fulfilled',
        season_number: null,
        media_type: 'movie',
        torrent_hash: 'abc',
        torrent_problem: null,
        resolved_at: new Date('2023-06-15T12:00:00Z'),
      };
      const model = toRequestModel(row);
      expect(model.resolved_at).toBe('2023-06-15T12:00:00.000Z');
    });

    it('serializes suggestion_computed_at as ISO string', () => {
      const row = {
        id: 1,
        title: 'Test',
        tmdb_id: 123,
        poster_path: null,
        overview: null,
        release_date: null,
        genre_ids: [],
        requested_by: 'Alice',
        requested_at: new Date('2023-06-01T00:00:00Z'),
        status: 'pending',
        season_number: null,
        media_type: 'movie',
        torrent_hash: null,
        torrent_problem: null,
        resolved_at: null,
        suggestion_hash: 'abc123',
        suggestion_score: 0.85,
        suggestion_computed_at: new Date('2023-06-10T08:30:00Z'),
      };
      const model = toRequestModel(row);
      expect(model.suggestion_hash).toBe('abc123');
      expect(model.suggestion_score).toBe(0.85);
      expect(model.suggestion_computed_at).toBe('2023-06-10T08:30:00.000Z');
    });

    it('coerces null suggestion fields to undefined', () => {
      const row = {
        id: 1,
        title: 'Test',
        tmdb_id: null,
        poster_path: null,
        overview: null,
        release_date: null,
        genre_ids: [],
        requested_by: 'Alice',
        requested_at: new Date(),
        status: 'pending',
        season_number: null,
        media_type: null,
        torrent_hash: null,
        torrent_problem: null,
        resolved_at: null,
        suggestion_hash: null,
        suggestion_score: null,
        suggestion_computed_at: null,
      };
      const model = toRequestModel(row);
      expect(model.suggestion_hash).toBeUndefined();
      expect(model.suggestion_score).toBeUndefined();
      expect(model.suggestion_computed_at).toBeUndefined();
    });

    it('coerces nulls to undefined for non-nullable fields', () => {
      const row = {
        id: 1,
        title: 'Test',
        tmdb_id: null,
        poster_path: null,
        overview: null,
        release_date: null,
        genre_ids: [],
        requested_by: 'Alice',
        requested_at: new Date(),
        status: 'pending',
        season_number: null,
        media_type: null,
        torrent_hash: null,
        torrent_problem: null,
        resolved_at: null,
      };
      const model = toRequestModel(row);
      expect(model.tmdb_id).toBeUndefined();
      expect(model.poster_path).toBeUndefined();
      expect(model.overview).toBeUndefined();
      expect(model.release_date).toBeUndefined();
      expect(model.season_number).toBeUndefined();
      expect(model.media_type).toBeUndefined();
      expect(model.torrent_problem).toBeUndefined();
    });
  });
});