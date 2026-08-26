import { torrentSearchIntent } from '../torrentsearch';

describe('torrentSearchIntent', () => {
  it('encodes the title for the Android SEARCH intent query', () => {
    expect(torrentSearchIntent('Dune: Part Two & Friends')).toBe(
      'intent:#Intent;action=android.intent.action.SEARCH;S.query=Dune%3A%20Part%20Two%20%26%20Friends;end',
    );
  });
});
