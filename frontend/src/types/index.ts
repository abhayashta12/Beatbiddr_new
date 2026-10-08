export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumCover: string;
}

export interface SongRequest {
  id: string;
  /** The DJ this request was sent to. Requests are never a global pool. */
  djId: string;
  song: Song;
  requester: {
    id: string;
    name: string;
    avatar: string;
  };
  tipAmount: number;
  message?: string;
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
  type: 'deposit' | 'tip' | 'withdrawal' | 'refund';
  amount: number;
  timestamp: string;
  recipient?: string;
  song?: { title: string; artist: string };
  paymentIntentId?: string;
  requestId?: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  walletBalance: number;
  transactions: Transaction[];
  favorites: DJ[];
}
