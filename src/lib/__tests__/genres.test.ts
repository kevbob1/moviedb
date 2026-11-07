import { getGenreNames } from '../genres';

describe('getGenreNames', () => {
  it('maps known ids in order and renders unknown ids as Unknown', () => {
    expect(getGenreNames([28, 9999, 0, 12])).toEqual(['Action', 'Unknown', 'Unknown', 'Adventure']);
  });

  it('defaults to an empty list', () => {
    expect(getGenreNames()).toEqual([]);
  });
});
