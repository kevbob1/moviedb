import { torrentSearchIntent } from '../torrentsearch';

describe('torrentSearchIntent', () => {
  it('encodes the title and release year for the Android SEARCH intent query', () => {
    expect(torrentSearchIntent('Dune: Part Two & Friends', '2024-03-01')).toBe(
      'intent:#Intent;action=android.intent.action.SEARCH;S.query=Dune%3A%20Part%20Two%20%26%20Friends%202024;end',
    );
  });

  it.each([undefined, null, 'not-a-date', '2024-02-30'])('uses only the title for invalid release date %s', (releaseDate) => {
    expect(torrentSearchIntent('Dune', releaseDate)).toBe(
      'intent:#Intent;action=android.intent.action.SEARCH;S.query=Dune;end',
    );
  });
});
