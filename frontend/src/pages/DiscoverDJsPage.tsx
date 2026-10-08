import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Music2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { setSelectedDJ } from '../utils/selectedDJ';

/**
 * Real DJs, from the public djs collection written by the server.
 *
 * It used to show three invented DJs and ask for the device's location to
 * decide nothing — the mock roster was returned either way. Both are gone:
 * no fabricated people, and no permission prompt we have no use for.
 */

interface DJPublic {
  uid: string;
  username: string;
  stageName: string;
  club: string;
  isLive: boolean;
  verified: boolean;
}

const MAX_DJS = 100;

const DiscoverDJsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [djs, setDjs] = useState<DJPublic[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'djs'), limit(MAX_DJS));
    return onSnapshot(
      q,
      (snap) => {
        setDjs(
          snap.docs
            .map((d) => ({ uid: d.id, ...(d.data() as Omit<DJPublic, 'uid'>) }))
            // A mirror with no stage name is incomplete — don't render a blank row
            .filter((dj) => dj.stageName)
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('DJ directory listener failed:', err);
        setError('Could not load DJs right now.');
        setLoading(false);
      }
    );
  }, []);

  const live = djs.filter((d) => d.isLive);
  const offline = djs.filter((d) => !d.isLive);

  const row = (dj: DJPublic) => (
    <li key={dj.uid}>
      <button
        onClick={() => {
          // Picking a DJ here is what routes every later request to them.
          setSelectedDJ(dj.uid);
          navigate('/customer');
        }}
        className="w-full flex items-center gap-3.5 py-4 text-left border-b border-white/[0.06]"
      >
        <div className="w-12 h-12 rounded-xl bg-dark-300 shrink-0 flex items-center justify-center">
          <span className="text-[15px] font-bold text-neutral-500">
            {dj.stageName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold tracking-[-0.02em] truncate flex items-center gap-1.5">
            {dj.stageName}
            {dj.verified && <BadgeCheck size={14} className="text-brand-500 shrink-0" />}
          </p>
          <p className="text-[12.5px] muted truncate">
            {dj.club ? `${dj.club} · ` : ''}@{dj.username}
          </p>
        </div>
        {dj.isLive && (
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" aria-label="Live" />
        )}
      </button>
    </li>
  );

  return (
    <AppShell>
      <div className="px-6 pt-6 pb-8">
        <h1 className="text-[26px] font-extrabold tracking-[-0.035em] leading-tight">Discover</h1>
        <p className="text-[13px] muted mt-1">DJs on BeatBiddr</p>

        {error ? (
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 mt-7">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-400 leading-relaxed">{error}</p>
          </div>
        ) : loading ? (
          <p className="text-[13.5px] muted mt-8">Loading…</p>
        ) : djs.length === 0 ? (
          <div className="py-16 text-center">
            <Music2 size={24} className="mx-auto text-neutral-600 mb-3" />
            <p className="text-[14px] muted max-w-[30ch] mx-auto leading-relaxed">
              No DJs have signed up yet. Check back soon.
            </p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section className="mt-7">
                <p className="label mb-1">Live now</p>
                <ul>{live.map(row)}</ul>
              </section>
            )}
            {offline.length > 0 && (
              <section className="mt-8">
                <p className="label mb-1">Not playing</p>
                <ul className="opacity-60">{offline.map(row)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};

export default DiscoverDJsPage;
