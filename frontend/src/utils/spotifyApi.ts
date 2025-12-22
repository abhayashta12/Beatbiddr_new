import axios from 'axios';

export const searchSpotify = async (token: string, query: string) => {
  const response = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, type: 'track', limit: 10 },
  });

  return response.data.tracks.items.map((item: any) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((a: any) => a.name).join(', '),
    albumCover: item.album.images[0]?.url || '',
  }));
};

export const getUserPlaylists = async (token: string) => {
  const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 20 },
  });

  return response.data.items.map((playlist: any) => ({
    id: playlist.id,
    name: playlist.name,
    image: playlist.images[0]?.url || '',
  }));
};
