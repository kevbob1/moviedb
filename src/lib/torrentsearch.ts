const TORRENT_SEARCH_INTENT = 'intent:#Intent;action=android.intent.action.SEARCH;S.query=';

/** Best-effort Chrome/Android hand-off; TorrentSearch has no normal web deep-link contract. */
export function torrentSearchIntent(title: string): string {
  return `${TORRENT_SEARCH_INTENT}${encodeURIComponent(title)};end`;
}
