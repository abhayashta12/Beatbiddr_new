import React, { useEffect, useState } from 'react';
import Navbar from '../components/layout/Navbar';
import WalletCard from '../components/customer/WalletCard';
import NearbyDJs from '../components/customer/NearbyDJs';
import SongCard from '../components/customer/SongCard';
import RequestForm from '../components/customer/RequestForm';
import type { DJ, SongRequest, Transaction, Song, SpotifyPlaylist } from '../types';
import { getSpotifyAuthUrl } from '../utils/spotifyAuth';
import { getUserPlaylists } from '../utils/spotifyApi';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  const { user } = useAuth();
  const navigate = useNavigate();

  const [walletBalance, setWalletBalance] = useState(0);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);

  // Load wallet balance + transactions from Firestore
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setWalletBalance(snap.data().walletBalance ?? 0);
        setTransactions(snap.data().transactions ?? []);
      }
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

  // Extract Spotify implicit grant token from URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const token = new URLSearchParams(hash.substring(1)).get('access_token');
      if (token) {
        setSpotifyToken(token);
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchPlaylists(token);
      }
    }
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

    if (walletBalance < tipAmount) {
      alert('Insufficient wallet balance. Please add funds first.');
      navigate('/wallet');
      return;
    }

    const newRequest = {
      song,
      requester: {
        id: user.uid,
        name: user.displayName ?? 'Anonymous',
        avatar: user.photoURL ?? '',
      },
      tipAmount,
      message,
      timestamp: new Date().toISOString(),
      status: 'pending' as const,
    };

    const newTransaction: Transaction = {
      id: `t-${Date.now()}`,
      type: 'tip',
      amount: tipAmount,
      timestamp: new Date().toISOString(),
      recipient: 'DJ Spinz',
      song,
    };

    const userRef = doc(db, 'users', user.uid);
    await Promise.all([
      addDoc(collection(db, 'songRequests'), newRequest),
      updateDoc(userRef, {
        walletBalance: walletBalance - tipAmount,
        transactions: arrayUnion(newTransaction),
      }),
    ]);
  };

  return (
    <div className="bg-dark-600 min-h-screen">
      <Navbar />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex justify-end mb-4">
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
