import {
  validateCreateRequestInput,
  validateRequestedBy,
} from '../validators';

describe('request-lifecycle/validators', () => {
  const baseInput = {
    tmdbId: 123,
    title: 'Test',
    posterPath: null,
    requestedBy: 'Alice',
    mediaType: 'movie',
  };

  describe('validateCreateRequestInput', () => {
    it('returns ok when title and requestedBy are present', () => {
      expect(validateCreateRequestInput(baseInput)).toEqual({ ok: true });
    });

    it('rejects empty title', () => {
      expect(validateCreateRequestInput({ ...baseInput, title: '' })).toEqual({
        ok: false,
        reason: 'Title is required',
      });
    });

    it('rejects whitespace-only title', () => {
      expect(validateCreateRequestInput({ ...baseInput, title: '   ' })).toEqual({
        ok: false,
        reason: 'Title is required',
      });
    });

    it('rejects empty requestedBy', () => {
      expect(validateCreateRequestInput({ ...baseInput, requestedBy: '' })).toEqual({
        ok: false,
        reason: 'Requester name is required',
      });
    });

    it('rejects whitespace-only requestedBy', () => {
      expect(validateCreateRequestInput({ ...baseInput, requestedBy: '\t\n' })).toEqual({
        ok: false,
        reason: 'Requester name is required',
      });
    });
  });

  describe('validateRequestedBy', () => {
    it('returns ok for non-empty string', () => {
      expect(validateRequestedBy('Alice')).toEqual({ ok: true });
    });

    it('rejects empty string', () => {
      expect(validateRequestedBy('')).toEqual({
        ok: false,
        reason: 'Requester name is required',
      });
    });

    it('rejects whitespace', () => {
      expect(validateRequestedBy('   ')).toEqual({
        ok: false,
        reason: 'Requester name is required',
      });
    });
  });
});