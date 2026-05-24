#!/usr/bin/env node

const JELLYFIN_URL = process.env.JELLYFIN_URL || "http://jellyfin.pd.o:8096";
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || "63bad4fe754d4a47b543c855c0d6701f";
const MOVIES_LIBRARY_ID = "f137a2dd21bbc1b99aa5c0f6bf02a805";

async function getMoviesFromLibrary() {
  const endpoint = `/Items?ParentId=${MOVIES_LIBRARY_ID}&IncludeItemTypes=Movie&Recursive=true&Fields=ProviderIds`;
  
  const res = await fetch(`${JELLYFIN_URL}${endpoint}`, {
    headers: {
      'Authorization': `MediaBrowser Token="${JELLYFIN_API_KEY}"`
    }
  });

  if (!res.ok) {
    console.error(`Error: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const data = await res.json();
  const items = data.Items || [];

  // Output as JSON
  console.log(JSON.stringify(items, null, 2));
}

getMoviesFromLibrary();
