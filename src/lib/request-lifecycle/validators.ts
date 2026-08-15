export interface CreateRequestInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  requestedBy: string;
  releaseDate?: string;
  overview?: string;
  genreIds?: number[];
  mediaType: string;
  seasonNumber?: number;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export const validateCreateRequestInput = (input: CreateRequestInput): ValidationResult => {
  if (!input.title?.trim()) {
    return { ok: false, reason: 'Title is required' };
  }
  if (!input.requestedBy?.trim()) {
    return { ok: false, reason: 'Requester name is required' };
  }
  return { ok: true };
};

export const validateRequestedBy = (requestedBy: string): ValidationResult => {
  if (!requestedBy?.trim()) {
    return { ok: false, reason: 'Requester name is required' };
  }
  return { ok: true };
};