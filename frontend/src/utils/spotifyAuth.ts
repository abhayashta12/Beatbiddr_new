// Spotify uses the implicit grant flow (token in URL hash) for this client-side MVP.
// The token is extracted in CustomerDashboard after the redirect.
export const getSpotifyAuthUrl = (): string => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID or VITE_SPOTIFY_REDIRECT_URI not set.');
  }

  const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-read-private',
  ];

  return `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scopes.join('%20')}`;
};
