export interface NotificationRequest {
  id: number;
  title: string;
  requested_by: string;
  status: string;
  requested_at: Date;
  release_date?: string | null;
  media_type?: string;
  season_number?: number | null;
}

export interface TvSeriesNotificationPayload {
  title: string;
  requestedBy: string;
  seasons: number[];
  totalSeasons: number;
  posterPath: string | null;
  releaseDate: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function getYear(releaseDate?: string | null): string {
  if (!releaseDate) return 'Unknown';
  const match = releaseDate.match(/^(\d{4})(?:[-/T]|$)/);
  if (match) return match[1];
  const year = new Date(releaseDate).getFullYear();
  return isNaN(year) ? 'Unknown' : String(year);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shell(titleHtml: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${titleHtml}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
${bodyHtml}
</body>
</html>`;
}

function linkButton(url: string, label: string): string {
  return `<p>
  <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 4px;">${escapeHtml(label)}</a>
</p>
<p style="color: #666; font-size: 0.9em;">
  <a href="${url}">${escapeHtml(url)}</a>
</p>`;
}

export function renderRequest(request: NotificationRequest, baseUrl: string): RenderedEmail {
  const year = getYear(request.release_date);
  const requestUrl = `${baseUrl}/requests/${encodeURIComponent(request.id)}`;
  const mediaLabel = request.media_type === 'tv' ? 'TV Show' : 'Movie';
  const seasonSuffix = request.season_number ? ` — Season ${request.season_number}` : '';
  const subject = `[JELLYFIN REQUEST] New Request: ${request.title}${seasonSuffix} (${year})`;

  const text = `A new media request has been submitted.

Requestor: ${request.requested_by}
${mediaLabel}: ${request.title}${seasonSuffix}
Year: ${year}

View request: ${requestUrl}`;

  const body = `
  <h2 style="color: #2c3e50;">New Media Request</h2>
  <p>A new media request has been submitted.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Requestor:</td>
      <td style="padding: 8px 0;">${escapeHtml(request.requested_by)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">${mediaLabel}:</td>
      <td style="padding: 8px 0; font-size: 1.2em; font-weight: bold;">${escapeHtml(request.title)}${seasonSuffix}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Year:</td>
      <td style="padding: 8px 0;">${year}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Status:</td>
      <td style="padding: 8px 0;">${escapeHtml(request.status)}</td>
    </tr>
  </table>
  ${linkButton(requestUrl, 'View Request')}
`;

  const html = shell(escapeHtml(request.title), body);
  return { subject, text, html };
}

export function renderTvSeries(payload: TvSeriesNotificationPayload, baseUrl: string): RenderedEmail {
  const year = getYear(payload.releaseDate);
  const listUrl = `${baseUrl}/requests`;
  const seasonRange = payload.seasons.length === 1
    ? `Season ${payload.seasons[0]}`
    : `Seasons ${payload.seasons[0]}-${payload.seasons[payload.seasons.length - 1]}`;
  const subject = `[JELLYFIN REQUEST] New TV Request: ${payload.title} (${seasonRange}, ${year})`;

  const seasonList = payload.seasons.map((s) => `Season ${s}`).join(', ');

  const text = `A new TV series request has been submitted.

Requestor: ${payload.requestedBy}
Show: ${payload.title}
${seasonList}
Year: ${year}

View requests: ${listUrl}`;

  const body = `
  <h2 style="color: #2c3e50;">New TV Series Request</h2>
  <p>A new TV series request has been submitted.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Requestor:</td>
      <td style="padding: 8px 0;">${escapeHtml(payload.requestedBy)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Show:</td>
      <td style="padding: 8px 0; font-size: 1.2em; font-weight: bold;">${escapeHtml(payload.title)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Seasons:</td>
      <td style="padding: 8px 0;">${escapeHtml(seasonList)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 16px 8px 0; font-weight: bold;">Year:</td>
      <td style="padding: 8px 0;">${year}</td>
    </tr>
  </table>
  ${linkButton(listUrl, 'View Requests')}
`;

  const html = shell(escapeHtml(subject), body);
  return { subject, text, html };
}

export function renderDailySummary(requests: NotificationRequest[], baseUrl: string): RenderedEmail {
  const count = requests.length;
  const subject = `[JELLYFIN REQUEST] Daily Summary: ${count} active request${count === 1 ? '' : 's'}`;
  const listUrl = `${baseUrl}/requests`;

  let text = `Daily Summary: ${count} active request${count === 1 ? '' : 's'}\n\n`;

  if (count === 0) {
    text += 'No active requests at this time.';
  } else {
    requests.forEach((req) => {
      const year = getYear(req.release_date);
      const seasonLabel = req.season_number ? ` S${req.season_number}` : '';
      text += `- "${req.title}"${seasonLabel} (${year}) — requested by ${req.requested_by} (${req.status})\n`;
    });
    text += `\nView all requests: ${listUrl}`;
  }

  const encodedListUrl = encodeURI(listUrl);

  let body: string;
  if (count === 0) {
    body = `
  <h2 style="color: #2c3e50;">Daily Summary</h2>
  <p>0 active requests.</p>
  <p>No active requests at this time.</p>
  ${linkButton(encodedListUrl, 'View All Requests')}
`;
  } else {
    const items = requests.map((req) => {
      const year = getYear(req.release_date);
      const requestUrl = `${baseUrl}/requests/${encodeURIComponent(req.id)}`;
      const seasonLabel = req.season_number ? ` S${req.season_number}` : '';
      return `<li style="margin: 8px 0;">
        <strong>${escapeHtml(req.title)}</strong>${seasonLabel} (${year}) —
        requested by ${escapeHtml(req.requested_by)} (${escapeHtml(req.status)})
        <a href="${requestUrl}">View</a>
      </li>`;
    }).join('');

    body = `
  <h2 style="color: #2c3e50;">Daily Summary</h2>
  <p>${count} active request${count === 1 ? '' : 's'}.</p>
  <ul style="padding-left: 20px;">${items}</ul>
  ${linkButton(encodedListUrl, 'View All Requests')}
`;
  }

  const html = shell('Daily Summary', body);
  return { subject, text, html };
}
