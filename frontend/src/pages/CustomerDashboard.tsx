import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import RequestSheet from '../components/customer/RequestSheet';
import type { SongRequest, Song } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { getSelectedDJ, clearSelectedDJ } from '../utils/selectedDJ';

const statusCopy: Record<SongRequest['status'], string> = {
  pending: 'Waiting on the DJ',
  accepted: 'In the queue',
  played: 'Played',
  rejected: 'Not played · refunded',
};

interface DJPublic {
  uid: string;
  username: string;
  stageName: string;
  club: string;
  isLive: boolean;
}

/** The identity-free queue mirror — no requester name, no message. */
interface QueueEntry {
  id: string;
  djId: string;
  status: SongRequest['status'];
  tipAmount: number;
  title: string;
  artist: string;
}

const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [walletBalance, setWalletBalance] = useState(0);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [djId, setDjId] = useState<string | null>(() => getSelectedDJ());
  const [dj, setDj] = useState<DJPublic | null>(null);

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
    return onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) })));
        setRequestsError(null);
      },
      // Without this the query could fail forever and the page would simply
      // look like the user had never requested anything.
      (err) => {
        console.error('Requests listener failed:', err);
        setRequestsError(
          err.code === 'failed-precondition'
            ? 'Your requests need a database index that has not been created yet.'
            : 'Could not load your requests right now.'
        );
      }
    );
  }, [user]);

  // Who the fan is with. The public mirror carries no identity data.
  useEffect(() => {
    if (!djId) {
      setDj(null);
      return;
    }
    return onSnapshot(
      doc(db, 'djs', djId),
      (snap) => {
        if (snap.exists()) {
          setDj({ uid: snap.id, ...(snap.data() as Omit<DJPublic, 'uid'>) });
        } else {
          // The DJ deleted their account — don't strand the fan on a ghost.
          clearSelectedDJ();
          setDjId(null);
          setDj(null);
        }
      },
      (err) => console.error('DJ listener failed:', err)
    );
  }, [djId]);

  // This DJ's accepted queue, highest tip first, so the fan can see where they
  // sit. Read from queueEntries rather than songRequests: the rules only let
  // someone read a request they sent or received, and this needs everyone's.
  useEffect(() => {
    if (!user || !djId) {
      setQueue([]);
      return;
    }
    const q = query(
      collection(db, 'queueEntries'),
      where('djId', '==', djId),
      where('status', '==', 'accepted'),
      orderBy('tipAmount', 'desc'),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => setQueue(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QueueEntry, 'id'>) }))),
      (err) => console.error('Queue listener failed:', err)
    );
  }, [user, djId]);

  /**
   * Throws on failure so the request sheet can keep itself open and show the
   * reason. It used to swallow every error, which meant the sheet closed as
   * though the request had been sent.
   */
  const handleRequestSubmit = async (song: Song, tipAmount: number, message: string) => {
    if (!user) throw new Error('Please sign in again.');
    if (!djId) throw new Error('Choose a DJ first.');
    if (walletBalance < tipAmount) {
      navigate('/wallet');
      return;
    }

    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Please sign in again.');

    const res = await fetch('/api/submit-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ djId, song, tipAmount, message }),
    });

    if (res.ok) return;

    const { error } = await res.json().catch(() => ({ error: null }));
    if (res.status === 402) {
      navigate('/wallet');
      return;
    }
    throw new Error(error ?? 'Could not send your request. Please try again.');
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
              {dj ? dj.stageName : 'Pick a DJ'}
            </h1>
            {dj ? (
              <button
                onClick={() => navigate('/discover')}
                className="text-[13px] muted mt-0.5 flex items-center gap-2"
              >
                {dj.isLive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block shrink-0" />
                )}
                <span className="truncate">
                  {dj.club ? `${dj.club} · ` : ''}
                  {dj.isLive ? 'Live now' : 'Not playing'}
                </span>
                <span className="text-brand-500 font-semibold shrink-0">Change</span>
              </button>
            ) : (
              <p className="text-[13px] muted mt-0.5">Choose who you’re listening to tonight.</p>
            )}
          </header>

          {/* No DJ chosen yet — nothing else on this page means anything */}
          {!dj && (
            <section className="mt-8">
              <p className="text-[13.5px] muted leading-relaxed max-w-[34ch]">
                Requests go to one DJ at a time. Pick the one you’re with and your songs land in
                their queue.
              </p>
              <button onClick={() => navigate('/discover')} className="btn-primary mt-6 px-6 py-3">
                Find your DJ
              </button>
            </section>
          )}

          {/* what the DJ is playing next — top of their accepted queue */}
          {dj && queue.length > 0 && (
            <section className="card p-4 mt-6 flex items-center gap-3.5">
              <div className="min-w-0 flex-1">
                <p className="label mb-1">Up next</p>
                <p className="text-[15px] font-bold tracking-[-0.02em] truncate leading-tight">
                  {queue[0].title}
                </p>
                <p className="text-[12.5px] muted truncate">{queue[0].artist}</p>
              </div>
              <span className="flex gap-[3px] items-end h-4 shrink-0" aria-hidden="true">
                <span className="w-[3px] h-2 bg-brand-500 rounded-full" />
                <span className="w-[3px] h-4 bg-brand-500 rounded-full" />
                <span className="w-[3px] h-2.5 bg-brand-500 rounded-full" />
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
              <span className="text-[17px] font-bold tracking-[-0.02em] tnum text-brand-500">
                ${walletBalance.toFixed(2)}
              </span>
              <Plus size={15} className="text-neutral-500" />
            </span>
          </button>
          <div className="rule" />

          {/* the current request, or an empty state */}
          {requestsError ? (
            <section className="mt-6 flex gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-400 leading-relaxed">
                {requestsError} Anything you’ve already sent is safe and the DJ can still see it.
              </p>
            </section>
          ) : active ? (
            <section className="mt-6">
              <p className="label">Your request</p>
              <p className="text-[17px] font-bold tracking-[-0.02em] mt-2.5 leading-snug">
                {active.song.title}
              </p>
              <p className="text-[13px] muted mt-0.5">
                {active.song.artist} · ${active.tipAmount.toFixed(2)} tip
              </p>

              <div className="flex items-end gap-3.5 mt-6">
                <span className="text-[56px] font-extrabold leading-[0.8] tracking-[-0.06em] tnum text-brand-500">
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
          ) : dj ? (
            <section className="mt-8">
              <p className="text-[17px] font-bold tracking-[-0.025em]">Nothing in the queue</p>
              <p className="text-[13.5px] muted mt-1.5 max-w-[34ch] leading-relaxed">
                Pick a track and add a tip. The bigger the tip, the sooner it plays.
              </p>
            </section>
          ) : null}

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

          {/* primary action — meaningless without a DJ to send it to */}
          {dj && (
            <div className="mt-auto pt-10">
              <button onClick={() => setSheetOpen(true)} className="btn-primary w-full">
                Request a song
              </button>
            </div>
          )}
        </div>
      </AppShell>

      <RequestSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleRequestSubmit}
        balance={walletBalance}
      />
    </>
  );
};

export default CustomerDashboard;
