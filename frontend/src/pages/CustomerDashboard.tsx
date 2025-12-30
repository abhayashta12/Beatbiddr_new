import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import WalletCard from '../components/customer/WalletCard';
import NearbyDJs from '../components/customer/NearbyDJs';
import SongCard from '../components/customer/SongCard';
import RequestForm from '../components/customer/RequestForm';
import { useAuth } from '../contexts/AuthContext'; // <-- adjust path if needed
import type { DJ, SongRequest, Transaction, Song, SpotifyPlaylist } from '../types';
import { getSpotifyAuthUrl } from '../utils/spotifyAuth';

const CustomerDashboard: React.FC = () => {
  const [walletBalance, setWalletBalance] = useState(0);
  const [djs, setDJs] = useState<DJ[]>([]);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedDJ, setSelectedDJ] = useState<DJ | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchRequests = async () => {
    try {
      const requestsRes = await fetch('/api/requests');
      const requestsData = await requestsRes.json();
      setRequests(requestsData);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Replace with your actual API endpoints
        const [walletRes, djsRes, transactionsRes] = await Promise.all([
          fetch('/api/wallet'),
          fetch('/api/djs'),
          fetch('/api/transactions'),
        ]);

        const walletData = await walletRes.json();
        const djsData = await djsRes.json();
        const transactionsData = await transactionsRes.json();

        setWalletBalance(walletData.balance);
        setDJs(djsData);
        setTransactions(transactionsData);
        
        fetchRequests();
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };

    fetchData();
  }, []);

  const exchangeCodeForToken = async (code: string) => {
  const res = await fetch(`/api/spotify/token?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Token endpoint failed');
  const data = await res.json();
  return data.access_token as string;
};

useEffect(() => {
  const saved = localStorage.getItem('spotify_access_token');
  if (saved) setSpotifyToken(saved);
}, []);

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

  const handleSelectDJ = (dj: DJ) => {
    setSelectedDJ(dj);
  };

  const handleRequestSubmit = async (song: Song, tipAmount: number, message: string) => {
    if (!selectedDJ) {
      console.error('No DJ selected');
      // Optionally, show an error to the user
      return;
    }
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, tipAmount, message, userId: user?.id, djId: selectedDJ.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      // Refetch requests to display the new one
      fetchRequests();

      setWalletBalance((prev) => prev - tipAmount);

      // Optimistically update transactions
      const newTransaction: Transaction = {
        id: `t-${Date.now()}`,
        type: 'tip',
        amount: tipAmount,
        timestamp: new Date().toISOString(),
        recipient: selectedDJ.name,
        song,
      };
      setTransactions([newTransaction, ...transactions]);
    } catch (error) {
      console.error('Failed to submit song request:', error);
    }
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
              <NearbyDJs djs={djs} onSelectDJ={handleSelectDJ} selectedDJ={selectedDJ} />

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