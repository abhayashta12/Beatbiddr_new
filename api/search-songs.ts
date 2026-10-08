import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';

/**
 * Song search, server-side.
 *
 * Spotify's /v1/search works with a Client Credentials token — an app-level
 * token obtained from our own client id and secret. It carries no user
 * identity, so nobody has to connect a Spotify account to search. User login
 * is only needed for personal data (playlists, library, recently played),
 * none of which this app uses.
 *
 * The client secret stays here. It is never sent to the browser, which is the
 * whole reason search runs through this endpoint instead of directly.
 */

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';
const MAX_QUERY_LENGTH = 100;
const RESULT_LIMIT = 10;

/**
 * Cached app token. Vercel reuses a warm instance across requests, so this
 * usually means one token call per hour per instance rather than one per
 * search. A cold start just fetches a fresh one.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Refresh 60s early so a token can't expire mid-flight. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

async function getAppToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Spotify credentials are not configured.'), { status: 503 });
  }

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Basic auth over the client id/secret pair, per Spotify's spec
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    // Never echo the body — it can repeat back parts of the credentials.
    console.error('Spotify token request failed with status', res.status);
    cachedToken = null;
    throw Object.assign(new Error('Song search is unavailable right now.'), { status: 503 });
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw Object.assign(new Error('Song search is unavailable right now.'), { status: 503 });
  }

  const lifetimeMs = (data.expires_in ?? 3600) * 1000;
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, lifetimeMs - TOKEN_SAFETY_MARGIN_MS),
  };
  return cachedToken.value;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Signed-in callers only. Without this the endpoint would be an open proxy
  // to our Spotify quota that anyone could run up.
  const uid = await verifyCaller(req);
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Search runs on every keystroke pause, so the ceiling is high — it exists
  // to stop a script burning our Spotify quota, not to slow down typing.
  const limited = await checkRateLimit(uid, {
    action: 'search',
    limit: 60,
    windowSeconds: 60,
  });
  if (!limited.allowed) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res.status(429).json({ error: 'Slow down a moment, then search again.' });
  }

  const raw = req.query.q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Search for a song title or artist.' });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: 'That search is too long.' });
  }

  try {
    const token = await getAppToken();

    const url = `${SPOTIFY_SEARCH_URL}?${new URLSearchParams({
      q: query,
      type: 'track',
      limit: String(RESULT_LIMIT),
    })}`;

    let spotifyRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    // A cached token rejected as expired: drop it and retry once with a fresh
    // one. Spotify can revoke before our own expiry estimate runs out.
    if (spotifyRes.status === 401) {
      cachedToken = null;
      const retryToken = await getAppToken();
      spotifyRes = await fetch(url, { headers: { Authorization: `Bearer ${retryToken}` } });
    }

    if (spotifyRes.status === 429) {
      return res.status(503).json({ error: 'Search is busy. Try again in a moment.' });
    }
    if (!spotifyRes.ok) {
      console.error('Spotify search failed with status', spotifyRes.status);
      return res.status(502).json({ error: 'Could not search songs right now.' });
    }

    const data = (await spotifyRes.json()) as { tracks?: { items?: SpotifyTrack[] } };
    const songs = (data.tracks?.items ?? []).map((item) => ({
      id: item.id,
      title: item.name,
      artist: item.artists.map((a) => a.name).join(', '),
      album: item.album?.name ?? '',
      // Smallest image last in Spotify's array; the largest is overkill for a
      // 44px row on a phone, so prefer the final (smallest) one.
      albumCover: item.album?.images?.[item.album.images.length - 1]?.url ?? '',
    }));

    // Private: the response is behind a user's bearer token, so it must never
    // land in a shared cache. Identical repeat searches still come from the
    // browser's own cache within the minute.
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({ songs });
  } catch (err: any) {
    const status = err.status ?? 500;
    if (status === 500) {
      console.error('search-songs failed:', err.message);
      return res.status(500).json({ error: 'Could not search songs right now.' });
    }
    return res.status(status).json({ error: err.message });
  }
}
