const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

if (!clientId) {
  console.error("Spotify Client ID not defined in env variables");
}
if (!redirectUri) {
  console.error("Spotify Redirect URI not defined in env variables");
}

const scopes = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-private',
];

export const getSpotifyAuthUrl = (): string => {
  const state = crypto.randomUUID(); // modern browsers
  sessionStorage.setItem('spotify_oauth_state', state);

  return `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scopes.join('%20')}&state=${state}&show_dialog=true`;
};

