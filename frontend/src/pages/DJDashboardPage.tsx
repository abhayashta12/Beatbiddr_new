import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Play } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import type { SongRequest } from '../types';
import { collection, onSnapshot, query, orderBy, where, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'incoming' | 'queue';

// Rejected requests are excluded — they are refundable, not earned. Played
// ones are kept so marking a song played does not erase it from the night's
// total. The cap stops the listener re-reading an unbounded collection on
// every snapshot.
const ACTIVE_STATUSES: SongRequest['status'][] = ['pending', 'accepted', 'played'];
const MAX_REQUESTS = 200;

const DJDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [tab, setTab] = useState<Tab>('incoming');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Scoped to this DJ. The rules require it — a request may only be read by
    // the fan who sent it or the DJ it was sent to, so an unscoped query is
    // rejected outright rather than quietly returning everyone's.
    const q = query(
      collection(db, 'songRequests'),
      where('djId', '==', user.uid),
      where('status', 'in', ACTIVE_STATUSES),
      orderBy('tipAmount', 'desc'),
      limit(MAX_REQUESTS)
    );
    return onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SongRequest, 'id'>) })));
        setError(null);
      },
      // Never leave a failed query looking like a quiet night.
      (err) => {
        console.error('Requests listener failed:', err);
        setError(
          err.code === 'failed-precondition'
            ? 'This list needs a database index that has not been created yet.'
            : 'Could not load requests. Pull to refresh or sign in again.'
        );
      }
    );
  }, [user]);

  const pending = requests.filter((r) => r.status === 'pending');
  const accepted = requests.filter((r) => r.status === 'accepted');
  // Accepted and played both count — the tip was already taken from the fan.
  const earnings = requests
    .filter((r) => r.status === 'accepted' || r.status === 'played')
    .reduce((sum, r) => sum + r.tipAmount, 0);

  /**
   * Goes through the server, not straight to Firestore. The endpoint checks
   * the request was sent to this DJ and, on a rejection, returns the tip to
   * the fan in the same transaction as the status change.
   */
  const setStatus = async (id: string, status: SongRequest['status']) => {
    setBusyId(id);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Please sign in again.');

      const res = await fetch('/api/update-request-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ requestId: id, status }),
      });

      if (!res.ok) {
        const { error: serverError } = await res.json().catch(() => ({ error: null }));
        throw new Error(serverError ?? 'That did not save.');
      }
    } catch (err: any) {
      console.error('Could not update request:', err);
      // A tap that silently did nothing is worse than an error.
      setError(err?.message ?? 'That did not save. Check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  };

  const list = tab === 'incoming' ? pending : accepted;

  return (
    <AppShell>
      <div className="px-6 pt-6 pb-8 flex flex-col min-h-full">
        <header>
          <p className="label">Tonight</p>
          <p className="text-[46px] font-extrabold tracking-[-0.045em] leading-none mt-2 tnum text-brand-500">
            ${earnings.toFixed(2)}
          </p>
          <p className="text-[13px] muted mt-2">
            {accepted.length} accepted · {pending.length} waiting
          </p>
        </header>

        {error && (
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 mt-5">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-400 leading-relaxed">{error}</p>
          </div>
        )}

        {/* up next — the highest tip in the accepted queue */}
        {accepted.length > 0 && (
          <section className="card p-4 mt-7">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl bg-dark-300 shrink-0 overflow-hidden">
                {accepted[0].song.albumCover && (
                  <img
                    src={accepted[0].song.albumCover}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="label mb-1">Up next</p>
                <p className="text-[16px] font-bold tracking-[-0.02em] truncate leading-tight">
                  {accepted[0].song.title}
                </p>
                <p className="text-[12.5px] muted truncate">
                  {accepted[0].song.artist} · ${accepted[0].tipAmount.toFixed(0)} from{' '}
                  {accepted[0].requester.name}
                </p>
              </div>
            </div>
            {accepted[0].message && (
              <p className="text-[13px] muted mt-3 leading-relaxed">“{accepted[0].message}”</p>
            )}
            <button
              onClick={() => setStatus(accepted[0].id, 'played')}
              disabled={busyId === accepted[0].id}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-3.5"
            >
              <Play size={16} /> Mark as played
            </button>
          </section>
        )}

        {/* switch */}
        <div className="flex gap-6 mt-8 border-b border-white/[0.12]">
          {(
            [
              ['incoming', `Incoming ${pending.length ? `(${pending.length})` : ''}`],
              ['queue', `Queue ${accepted.length ? `(${accepted.length})` : ''}`],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 -mb-px text-[14px] font-bold tracking-[-0.015em] border-b-2 transition-colors ${
                tab === key
                  ? 'border-brand-500 text-brand-500'
                  : 'border-transparent text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* list */}
        {list.length === 0 ? (
          <p className="text-[14px] muted mt-8">
            {tab === 'incoming' ? 'No requests waiting.' : 'Nothing queued yet.'}
          </p>
        ) : (
          <ul className="flex flex-col mt-2">
            {list.map((r) => (
              <li key={r.id} className="py-5 border-b border-white/[0.06]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold tracking-[-0.02em] leading-snug truncate">
                      {r.song.title}
                    </p>
                    <p className="text-[13px] muted mt-0.5 truncate">{r.song.artist}</p>
                    <p className="text-[12.5px] muted mt-1.5 truncate">
                      {r.requester.name}
                      {r.message ? ` · “${r.message}”` : ''}
                    </p>
                  </div>
                  <span className="text-[20px] font-extrabold tracking-[-0.03em] tnum shrink-0 text-brand-500">
                    ${r.tipAmount.toFixed(0)}
                  </span>
                </div>

                <div className="flex gap-2.5 mt-4">
                  {tab === 'incoming' ? (
                    <>
                      <button
                        onClick={() => setStatus(r.id, 'accepted')}
                        disabled={busyId === r.id}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 py-3.5"
                      >
                        <Check size={17} /> Accept
                      </button>
                      <button
                        onClick={() => setStatus(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        className="btn-ghost px-5 py-3.5 flex items-center justify-center"
                        aria-label="Reject"
                      >
                        <X size={17} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setStatus(r.id, 'played')}
                      disabled={busyId === r.id}
                      className="btn-ghost flex-1 flex items-center justify-center gap-2 py-3.5"
                    >
                      <Play size={15} /> Mark as played
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
};

export default DJDashboardPage;
