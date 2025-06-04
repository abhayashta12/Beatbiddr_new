export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumCover: string;
}

export interface SongRequest {
  id: string;
  song: Song;
  requester: {
    id: string;
    name: string;
    avatar: string;
  };
  tipAmount: number;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected' | 'played';
}

export interface DJ {
  id: string;
  name: string;
  avatar: string;
  club: string;
  location: string;
  genre: string[];
  rating: number;
  isLive: boolean;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'tip' | 'withdrawal';
  amount: number;
  timestamp: string;
  recipient?: string;
  song?: Song;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  walletBalance: number;
  transactions: Transaction[];
  favorites: DJ[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  image: string;
}
