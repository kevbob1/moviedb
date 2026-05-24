interface JellyfinItemsResponse {
  Items?: unknown;
}

export interface JellyfinStatus {
  available: boolean;
  error?: string;
  configured: boolean;
}

export interface JellyfinMultiStatus {
  status: Map<number, boolean>;
  error?: string;
  configured: boolean;
}

export interface JellyfinCheckResult {
  results: Record<number, boolean>;
  error?: string;
  configured: boolean;
}

async function queryJellyfinItems(endpoint: string): Promise<{ data: JellyfinItemsResponse | null; error?: string }> {
const jellyfinUrl = process.env.JELLYFIN_URL || "";
const jellyfinApiKey = process.env.JELLYFIN_API_KEY || "";

if (!jellyfinUrl || !jellyfinApiKey) {
return { data: null, error: 'Jellyfin not configured' };
}

try {
const response = await fetch(`${jellyfinUrl}${endpoint}`, {
headers: {
'Authorization': `MediaBrowser Token="${jellyfinApiKey}"`
}
});

if (!response.ok) {
return { data: null, error: `Jellyfin API error: ${response.status} ${response.statusText}` };
}

return { data: await response.json() };
} catch (err) {
const errorMessage = err instanceof Error ? err.message : 'Network error';
return { data: null, error: `Jellyfin connection failed: ${errorMessage}` };
}
}

export async function checkMovieOnJellyfin(tmdbId: number): Promise<JellyfinCheckResult> {
if (!tmdbId) {
return { results: {}, configured: false, error: 'Invalid movie ID' };
}

const { data, error } = await queryJellyfinItems(
`/Items?AnyProviderIdEquals=tmdb.${tmdbId}&IncludeItemTypes=Movie`
);

if (error && !data) {
return { results: {}, configured: false, error };
}

const isAvailable = (data?.Items as unknown[])?.length > 0 || false;
return { 
  results: { [tmdbId]: isAvailable }, 
  configured: true 
};
}

export async function checkMoviesOnJellyfin(tmdbIds: number[]): Promise<JellyfinCheckResult> {
if (!tmdbIds?.length) {
return { results: {}, configured: false };
}

const jellyfinUrl = process.env.JELLYFIN_URL || "";
const jellyfinApiKey = process.env.JELLYFIN_API_KEY || "";

if (!jellyfinUrl || !jellyfinApiKey) {
const results: Record<number, boolean> = {};
tmdbIds.forEach(id => results[id] = false);
return { results, configured: false, error: 'Jellyfin not configured' };
}

const anyProviderIdEquals = tmdbIds.map(id => `tmdb.${id}`).join('|');
const { data, error } = await queryJellyfinItems(
`/Items?AnyProviderIdEquals=${anyProviderIdEquals}&IncludeItemTypes=Movie`
);

const results: Record<number, boolean> = {};
tmdbIds.forEach(id => results[id] = false);

if (error && !data) {
return { results, configured: false, error };
}

if (data?.Items) {
const items = data.Items as unknown[];
items.forEach((item) => {
if (item && typeof item === 'object' && 'ProviderIds' in item) {
const providerIds = (item as { ProviderIds?: { tmdb?: string } }).ProviderIds;
const tmdbId = providerIds?.tmdb;
if (tmdbId && tmdbIds.includes(parseInt(tmdbId, 10))) {
results[parseInt(tmdbId, 10)] = true;
}
}
});
}

return { results, configured: true };
}

export async function isMovieOnJellyfin(tmdbId: number): Promise<JellyfinStatus> {
if (!tmdbId) {
return { available: false, configured: false, error: 'Invalid movie ID' };
}

const { data, error } = await queryJellyfinItems(
`/Items?AnyProviderIdEquals=tmdb.${tmdbId}&IncludeItemTypes=Movie`
);

if (error && !data) {
return { available: false, configured: false, error };
}

return { 
  available: (data?.Items as unknown[])?.length > 0, 
  configured: true 
};
}

export async function areMoviesOnJellyfin(tmdbIds: number[]): Promise<Map<number, boolean>> {
const result = new Map<number, boolean>();
const jellyfinUrl = process.env.JELLYFIN_URL || "";
const jellyfinApiKey = process.env.JELLYFIN_API_KEY || "";

if (!tmdbIds?.length) {
return result;
}

tmdbIds.forEach(id => result.set(id, false));

if (!jellyfinUrl || !jellyfinApiKey) {
return result;
}

const anyProviderIdEquals = tmdbIds.map(id => `tmdb.${id}`).join('|');
const { data } = await queryJellyfinItems(
`/Items?AnyProviderIdEquals=${anyProviderIdEquals}&IncludeItemTypes=Movie`
);

if (data?.Items) {
const items = data.Items as unknown[];
items.forEach((item) => {
if (item && typeof item === 'object' && 'ProviderIds' in item) {
const providerIds = (item as { ProviderIds?: { tmdb?: string } }).ProviderIds;
const tmdbId = providerIds?.tmdb;
if (tmdbId && result.has(parseInt(tmdbId, 10))) {
result.set(parseInt(tmdbId, 10), true);
}
}
});
}

return result;
}
