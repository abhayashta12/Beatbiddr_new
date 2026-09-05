const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-private',
];

const generateCodeVerifier = (): string => {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const redirectToSpotifyLogin = async (): Promise<void> => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID or VITE_SPOTIFY_REDIRECT_URI not set.');
  }

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  sessionStorage.setItem('spotify_code_verifier', verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
};

const TOKEN_STORAGE_KEY = 'spotify_token';

interface StoredSpotifyToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

const saveToken = (data: { access_token: string; refresh_token?: string; expires_in: number }) => {
  const stored: StoredSpotifyToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Refresh 60s before actual expiry to avoid using a stale token mid-request
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(stored));
};

export const clearSpotifyToken = () => localStorage.removeItem(TOKEN_STORAGE_KEY);

export const exchangeCodeForToken = async (code: string): Promise<string> => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  const verifier = sessionStorage.getItem('spotify_code_verifier');

  if (!verifier) throw new Error('Missing PKCE code verifier.');

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error('Failed to exchange Spotify code for token.');

  const data = await res.json();
  sessionStorage.removeItem('spotify_code_verifier');
  saveToken(data);
  return data.access_token as string;
};

const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const data = await res.json();
  // Spotify may or may not rotate the refresh token; keep the old one if not.
  saveToken({ ...data, refresh_token: data.refresh_token ?? refreshToken });
  return data.access_token as string;
};

/**
 * Returns a valid access token from storage, refreshing it silently if expired.
 * Returns null if the user has never connected (or the refresh failed).
 */
export const getValidSpotifyToken = async (): Promise<string | null> => {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const stored: StoredSpotifyToken = JSON.parse(raw);
    if (Date.now() < stored.expiresAt) return stored.accessToken;
    if (stored.refreshToken) {
      const refreshed = await refreshAccessToken(stored.refreshToken);
      if (refreshed) return refreshed;
    }
  } catch {
    // fall through to clear
  }
  clearSpotifyToken();
  return null;
};
