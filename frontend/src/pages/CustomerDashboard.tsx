import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import RequestSheet from '../components/customer/RequestSheet';
import type { SongRequest, Song } from '../types';
import { redirectToSpotifyLogin, exchangeCodeForToken, getValidSpotifyToken } from '../utils/spotifyAuth';
import { getUserPlaylists } from '../utils/spotifyApi';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const statusCopy: Record<SongRequest['status'], string> = {
  pending: 'Waiting on the DJ',
  accepted: 'In the queue',
  played: 'Played',
  rejected: 'Not played · refunded',
};

const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [walletBalance, setWalletBalance] = useState(0);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queue, setQueue] = useState<SongRequest[]>([]);

  // Balance — written only by the server
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setWalletBalance(snap.data().walletBalance ?? 0);
    });
  }, [user]);

  // This user's requests, newest first
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'songRequests'),
      where('requester.id', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) })));
    });
  }, [user]);

  // The accepted queue, highest tip first — needed to work out where this
  // user sits in line. Computing it from their own requests alone would give
  // a position that is always 1.
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'songRequests'),
      where('status', '==', 'accepted'),
      orderBy('tipAmount', 'desc'),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => setQueue(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) }))),
      (err) => console.error('Queue listener failed:', err)
    );
  }, [user]);

  // Spotify: finish the PKCE redirect, or restore a stored token
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      exchangeCodeForToken(code)
        .then(setSpotifyToken)
        .catch((err) => console.error('Spotify token exchange failed:', err));
      return;
    }
    getValidSpotifyToken().then((token) => token && setSpotifyToken(token));
  }, []);

  // Keep the token warm for search; playlists aren't shown on this screen
  useEffect(() => {
    if (spotifyToken) getUserPlaylists(spotifyToken).catch(() => {});
  }, [spotifyToken]);

  const handleRequestSubmit = async (song: Song, tipAmount: number, message: string) => {
    if (!user) return;
    if (walletBalance < tipAmount) {
      navigate('/wallet');
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in.');

      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ song, tipAmount, message }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }));
        if (res.status === 402) {
          navigate('/wallet');
        } else {
          alert(error ?? 'Could not send your request. Please try again.');
        }
      }
    } catch (err) {
      console.error('Request submission failed:', err);
      alert('Could not reach the server. Check your connection and try again.');
    }
  };

  const active = requests.find((r) => r.status === 'pending' || r.status === 'accepted');
  // Rank within the whole accepted queue, not just this user's own requests.
  const position =
    active && active.status === 'accepted'
      ? queue.findIndex((r) => r.id === active.id) + 1
      : 0;

  return (
    <>
      <AppShell>
        <div className="px-6 pt-6 pb-8 flex flex-col min-h-full">
          {/* who you're with */}
          <header>
            <h1 className="text-[26px] font-extrabold tracking-[-0.035em] leading-tight">
              DJ Spinz
            </h1>
            <p className="text-[13px] muted mt-0.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              Neon Lounge · Live now
            </p>
          </header>

          {/* what the DJ is playing next — real data, top of the accepted queue */}
          {queue.length > 0 && (
            <section className="card p-4 mt-6 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-dark-300 shrink-0 overflow-hidden">
                {queue[0].song.albumCover && (
                  <img
                    src={queue[0].song.albumCover}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="label mb-1">Up next</p>
                <p className="text-[15px] font-bold tracking-[-0.02em] truncate leading-tight">
                  {queue[0].song.title}
                </p>
                <p className="text-[12.5px] muted truncate">{queue[0].song.artist}</p>
              </div>
              <span className="flex gap-[3px] items-end h-4 shrink-0" aria-hidden="true">
                <span className="w-[3px] h-2 bg-white/70 rounded-full" />
                <span className="w-[3px] h-4 bg-white/70 rounded-full" />
                <span className="w-[3px] h-2.5 bg-white/70 rounded-full" />
              </span>
            </section>
          )}

          {/* balance */}
          <div className="rule mt-6" />
          <button
            onClick={() => navigate('/wallet')}
            className="flex items-baseline justify-between w-full py-4 text-left"
          >
            <span className="text-[13.5px] muted">Balance</span>
            <span className="flex items-baseline gap-2">
              <span className="text-[17px] font-bold tracking-[-0.02em] tnum">
                ${walletBalance.toFixed(2)}
              </span>
              <Plus size={15} className="text-neutral-500" />
            </span>
          </button>
          <div className="rule" />

          {/* the current request, or an empty state */}
          {active ? (
            <section className="mt-6">
              <p className="label">Your request</p>
              <p className="text-[17px] font-bold tracking-[-0.02em] mt-2.5 leading-snug">
                {active.song.title}
              </p>
              <p className="text-[13px] muted mt-0.5">
                {active.song.artist} · ${active.tipAmount.toFixed(2)} tip
              </p>

              <div className="flex items-end gap-3.5 mt-6">
                <span className="text-[56px] font-extrabold leading-[0.8] tracking-[-0.06em] tnum">
                  {position > 0 ? String(position).padStart(2, '0') : '—'}
                </span>
                <span className="text-[12.5px] muted leading-snug pb-1">
                  {position > 0 ? (
                    <>
                      in queue
                      <br />
                      {position === 1 ? 'up next' : 'accepted'}
                    </>
                  ) : (
                    statusCopy[active.status]
                  )}
                </span>
              </div>
            </section>
          ) : (
            <section className="mt-8">
              <p className="text-[17px] font-bold tracking-[-0.025em]">Nothing in the queue</p>
              <p className="text-[13.5px] muted mt-1.5 max-w-[34ch] leading-relaxed">
                Pick a track and add a tip. The bigger the tip, the sooner it plays.
              </p>
            </section>
          )}

          {/* recent history, quietly */}
          {requests.length > (active ? 1 : 0) && (
            <section className="mt-8">
              <p className="label mb-3">Earlier tonight</p>
              <ul className="flex flex-col gap-3">
                {requests
                  .filter((r) => r.id !== active?.id)
                  .slice(0, 4)
                  .map((r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] truncate">{r.song.title}</span>
                      <span className="text-[12px] muted shrink-0">{statusCopy[r.status]}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {/* primary action */}
          <div className="mt-auto pt-10 flex flex-col gap-3">
            {!spotifyToken && (
              <button
                onClick={() => redirectToSpotifyLogin()}
                className="text-[13px] font-semibold text-neutral-500 hover:text-white py-1"
              >
                Connect Spotify for full search
              </button>
            )}
            <button onClick={() => setSheetOpen(true)} className="btn-primary w-full">
              Request a song
            </button>
          </div>
        </div>
      </AppShell>

      <RequestSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleRequestSubmit}
        spotifyToken={spotifyToken}
        balance={walletBalance}
      />
    </>
  );
};

export default CustomerDashboard;
