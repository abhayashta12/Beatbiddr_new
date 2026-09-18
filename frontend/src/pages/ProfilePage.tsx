import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Music2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { clearSpotifyToken } from '../utils/spotifyAuth';
import type { SongRequest } from '../types';
import { collection, onSnapshot, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const statusCopy: Record<SongRequest['status'], string> = {
  pending: 'Waiting',
  accepted: 'In queue',
  played: 'Played',
  rejected: 'Refunded',
};

const ProfilePage: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [requests, setRequests] = useState<SongRequest[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setBalance(snap.data().walletBalance ?? 0);
    });
  }, [user]);

  // A customer's own request history; DJs see their played tracks instead.
  useEffect(() => {
    if (!user) return;
    const q =
      role === 'dj'
        ? query(collection(db, 'songRequests'), orderBy('tipAmount', 'desc'), limit(30))
        : query(
            collection(db, 'songRequests'),
            where('requester.id', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(30)
          );
    return onSnapshot(
      q,
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) }))),
      (err) => console.error('History listener failed:', err)
    );
  }, [user, role]);

  const isDJ = role === 'dj';
  const played = requests.filter((r) => r.status === 'played');
  const totalTipped = requests
    .filter((r) => r.status !== 'rejected')
    .reduce((sum, r) => sum + r.tipAmount, 0);

  const handleLogout = async () => {
    clearSpotifyToken();
    await logout();
    navigate('/');
  };

  const stats = isDJ
    ? [
        { value: played.length, label: 'Played' },
        { value: `$${totalTipped.toFixed(0)}`, label: 'Earned' },
      ]
    : [
        { value: requests.length, label: 'Requests' },
        { value: `$${totalTipped.toFixed(0)}`, label: 'Tipped' },
        { value: `$${balance.toFixed(0)}`, label: 'Balance' },
      ];

  return (
    <AppShell>
      <div className="px-6 pt-6 pb-8 flex flex-col min-h-full">
        <header className="flex items-center gap-3.5">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-dark-400 shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold tracking-[-0.035em] leading-tight truncate">
              {user?.displayName ?? 'Your account'}
            </h1>
            <p className="text-[13px] muted truncate">{user?.email}</p>
            <p className="text-[12px] muted mt-0.5">{isDJ ? 'DJ / Artist' : 'Music Fan'}</p>
          </div>
        </header>

        {/* stats */}
        <div className="grid grid-cols-3 gap-2.5 mt-7">
          {stats.map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-[22px] font-extrabold tracking-[-0.03em] tnum leading-none">
                {s.value}
              </p>
              <p className="label mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>

        {!isDJ && (
          <button
            onClick={() => navigate('/wallet')}
            className="flex items-center justify-between py-4 w-full text-left mt-5 border-t border-white/[0.12]"
          >
            <span className="text-[14.5px] font-semibold">Wallet &amp; transactions</span>
            <ChevronRight size={17} className="text-neutral-500" />
          </button>
        )}

        {/* history */}
        <section className="mt-6">
          <p className="label mb-3">{isDJ ? 'Recently played' : 'Your requests'}</p>
          {requests.length === 0 ? (
            <div className="py-10 text-center">
              <Music2 size={24} className="mx-auto text-neutral-600 mb-3" />
              <p className="text-[14px] muted">
                {isDJ ? 'No requests yet tonight.' : 'You haven’t requested anything yet.'}
              </p>
              {!isDJ && (
                <button
                  onClick={() => navigate('/customer')}
                  className="btn-primary mt-5 px-6 py-3"
                >
                  Request a song
                </button>
              )}
            </div>
          ) : (
            <ul className="flex flex-col">
              {requests.slice(0, 12).map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-4 py-3.5 border-b border-white/[0.08] last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold truncate">{r.song.title}</p>
                    <p className="text-[12px] muted truncate">
                      {r.song.artist} · ${r.tipAmount.toFixed(0)}
                    </p>
                  </div>
                  <span className="text-[12px] muted shrink-0">{statusCopy[r.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-auto pt-10">
          <p className="text-[12px] muted mb-4 leading-relaxed">
            Each account holds one role. To use BeatBiddr the other way, delete this profile and
            sign up again.
          </p>
          <button onClick={handleLogout} className="btn-ghost w-full">
            Log out
          </button>
        </div>
      </div>
    </AppShell>
  );
};

export default ProfilePage;
