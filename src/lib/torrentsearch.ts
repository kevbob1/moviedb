const TORRENT_SEARCH_INTENT = 'intent:#Intent;action=android.intent.action.SEARCH;S.query=';

/** Best-effort Chrome/Android hand-off; TorrentSearch has no normal web deep-link contract. */
export function torrentSearchIntent(title: string, releaseDate?: string | null): string {
  const releaseYear = releaseDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const query = releaseYear && isValidDate(releaseYear[1], releaseYear[2], releaseYear[3])
    ? `${title} ${releaseYear[1]}`
    : title;

  return `${TORRENT_SEARCH_INTENT}${encodeURIComponent(query)};end`;
}

function isValidDate(year: string, month: string, day: string): boolean {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}
