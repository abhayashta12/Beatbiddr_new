import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import WalletCard from '../components/customer/WalletCard';
import NearbyDJs from '../components/customer/NearbyDJs';
import SongCard from '../components/customer/SongCard';
import RequestForm from '../components/customer/RequestForm';
import { useAuth } from '../contexts/AuthContext'; // <-- adjust path if needed
import type { DJ, SongRequest, Transaction, Song, SpotifyPlaylist } from '../types';

// ✅ Spotify Auth Helper — fully preserved
const getSpotifyAuthUrl = (): string => {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Spotify client ID or redirect URI not set in environment variables.');
  }

  const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-library-read',
    'user-read-private',
  ];

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scopes.join('%20')}`;

  console.log('Generated Spotify OAuth URL:', authUrl);
  return authUrl;
};

// ✅ Mock Data fully preserved
const mockDJs: DJ[] = [
  {
    id: '1',
    name: 'DJ Spinz',
    avatar:
      'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'Neon Lounge',
    location: 'Downtown',
    genre: ['House', 'EDM'],
    rating: 4.8,
    isLive: true,
  },
  {
    id: '2',
    name: 'DJ Beatrix',
    avatar:
      'https://images.pexels.com/photos/3484683/pexels-photo-3484683.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'The Vault',
    location: 'South District',
    genre: ['Hip-Hop', 'R&B'],
    rating: 4.6,
    isLive: false,
  },
];

const mockRequests: SongRequest[] = [
  {
    id: '1',
    song: {
      id: '101',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      albumCover:
        'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    },
    requester: {
      id: 'user1',
      name: 'Alex Johnson',
      avatar: 'https://example.com/avatar1.jpg',
    },
    tipAmount: 15,
    timestamp: new Date().toISOString(),
    status: 'pending',
  },
  {
    id: '2',
    song: {
      id: '102',
      title: "Don't Start Now",
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      albumCover:
        'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    },
    requester: {
      id: 'user1',
      name: 'Alex Johnson',
      avatar: 'https://example.com/avatar1.jpg',
    },
    tipAmount: 10,
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    status: 'accepted',
  },
];

const mockTransactions: Transaction[] = [
  {
    id: 't1',
    type: 'deposit',
    amount: 50,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 't2',
    type: 'tip',
    amount: 15,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    recipient: 'DJ Spinz',
    song: {
      id: '101',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      albumCover: 'https://example.com/album1.jpg',
    },
  },
];

// ✅ Main Customer Dashboard Component — 100% preserved logic (with Logout)
const CustomerDashboard: React.FC = () => {
  const [walletBalance, setWalletBalance] = useState(35);
  const [requests, setRequests] = useState<SongRequest[]>(mockRequests);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const exchangeCodeForToken = async (code: string) => {
  const res = await fetch(`/api/spotify/token?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Token endpoint failed');
  const data = await res.json();
  return data.access_token as string;
};

useEffect(() => {
  const run = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) return;

    try {
      const token = await exchangeCodeForToken(code); // you will add this function below
      setSpotifyToken(token);

      // remove ?code=... from URL (keeps /customer)
      window.history.replaceState({}, document.title, window.location.pathname);

      fetchPlaylists(token);
    } catch (e) {
      console.error('Spotify token exchange failed:', e);
    }
  };

  run();
}, []);

  const fetchPlaylists = async (token: string) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      const mapped = data.items.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        image: playlist.images?.[0]?.url || '',
      }));

      setUserPlaylists(mapped);
    } catch (err) {
      console.error('Error fetching playlists', err);
    }
  };

  const handleRequestSubmit = (song: Song, tipAmount: number, message: string) => {
    const newRequest: SongRequest = {
      id: `req-${Date.now()}`,
      song,
      requester: {
        id: 'user1',
        name: 'Alex Johnson',
        avatar: 'https://example.com/avatar1.jpg',
      },
      tipAmount,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'tip',
      amount: tipAmount,
      timestamp: new Date().toISOString(),
      recipient: 'DJ Spinz',
      song,
    };

    setRequests([newRequest, ...requests]);
    setTransactions([newTransaction, ...transactions]);
    setWalletBalance((prev) => prev - tipAmount);
  };

  // ✅ Logout handler (safe + redirect to login)
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex justify-end mb-4 gap-3">
          {!spotifyToken ? (
            <button
              onClick={() => (window.location.href = getSpotifyAuthUrl())}
              className="btn-accent"
            >
              Connect Spotify
            </button>
          ) : (
            <p className="text-sm text-green-400 font-medium">Spotify Connected 🎧</p>
          )}

          {/* Visible when signed in; logs out and goes to /login */}
          {user && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-dark-400 transition-all duration-200"
            >
              Logout
            </button>
          )}
        </div>

        <div className="py-6">
          <h1 className="text-3xl font-bold mb-6">Your Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <WalletCard balance={walletBalance} recentTransactions={transactions.slice(0, 3)} />
              <NearbyDJs djs={mockDJs} />

              <div className="card p-6">
                <div className="flex items-center mb-6">
                  <h2 className="text-xl font-semibold">Your Recent Requests</h2>
                </div>

                {requests.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No song requests yet</p>
                    <p className="text-sm text-gray-500 mt-1">Use the form to request songs</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <SongCard key={request.id} request={request} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <RequestForm
                onSubmit={handleRequestSubmit}
                spotifyToken={spotifyToken}
                userPlaylists={userPlaylists}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
