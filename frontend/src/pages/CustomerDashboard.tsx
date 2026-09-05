import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import WalletCard from '../components/customer/WalletCard';
import NearbyDJs from '../components/customer/NearbyDJs';
import SongCard from '../components/customer/SongCard';
import RequestForm from '../components/customer/RequestForm';
import type { DJ, SongRequest, Transaction, Song, SpotifyPlaylist } from '../types';
import { redirectToSpotifyLogin, exchangeCodeForToken } from '../utils/spotifyAuth';
import { getUserPlaylists } from '../utils/spotifyApi';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  doc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

const mockDJs: DJ[] = [
  {
    id: '1',
    name: 'DJ Spinz',
    avatar: 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'Neon Lounge',
    location: 'Downtown',
    genre: ['House', 'EDM'],
    rating: 4.8,
    isLive: true,
  },
  {
    id: '2',
    name: 'DJ Beatrix',
    avatar: 'https://images.pexels.com/photos/3484683/pexels-photo-3484683.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    club: 'The Vault',
    location: 'South District',
    genre: ['Hip-Hop', 'R&B'],
    rating: 4.6,
    isLive: false,
  },
];

const CustomerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const [walletBalance, setWalletBalance] = useState(0);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);

  // Wallet balance — written only by the server
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setWalletBalance(snap.data().walletBalance ?? 0);
      }
    });
    return unsub;
  }, [user]);

  // Recent transactions from the server-written ledger
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'ledger'),
      orderBy('timestamp', 'desc'),
      limit(3)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }))
      );
    });
    return unsub;
  }, [user]);

  // Load song requests from Firestore (real-time)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'songRequests'),
      where('requester.id', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) }))
      );
    });
    return unsub;
  }, [user]);

  // Handle Spotify PKCE redirect — exchange code for token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    window.history.replaceState({}, document.title, window.location.pathname);

    exchangeCodeForToken(code).then((token) => {
      setSpotifyToken(token);
      fetchPlaylists(token);
    }).catch((err) => {
      console.error('Spotify token exchange failed:', err);
    });
  }, []);

  const fetchPlaylists = async (token: string) => {
    try {
      const playlists = await getUserPlaylists(token);
      setUserPlaylists(playlists);
    } catch (err) {
      console.error('Error fetching playlists', err);
    }
  };

  const handleRequestSubmit = async (song: Song, tipAmount: number, message: string) => {
    if (!user) return;

    // Quick client-side check for UX; the server re-verifies atomically.
    if (walletBalance < tipAmount) {
      alert('Insufficient wallet balance. Please add funds first.');
      navigate('/wallet');
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in.');

      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ song, tipAmount, message }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        if (res.status === 402) {
          alert('Insufficient wallet balance. Please add funds first.');
          navigate('/wallet');
        } else {
          alert(error ?? 'Failed to submit request. Please try again.');
        }
      }
    } catch (err) {
      console.error('Request submission failed:', err);
      alert('Failed to submit request. Please try again.');
    }
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex justify-end items-center gap-3 mb-4">
          {!spotifyToken ? (
            <button
              onClick={() => redirectToSpotifyLogin()}
              className="btn-accent"
            >
              Connect Spotify
            </button>
          ) : (
            <p className="text-sm text-green-400 font-medium">Spotify Connected 🎧</p>
          )}
          <button
            onClick={handleLogout}
            className="btn-ghost flex items-center text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </button>
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
