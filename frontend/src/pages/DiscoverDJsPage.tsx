import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import type { DJ } from '../types';

// Placeholder roster until DJ discovery reads from Firestore (Phase 2).
const mockDJs: DJ[] = [
  {
    id: '1',
    name: 'DJ Spinz',
    avatar: '',
    club: 'Neon Lounge',
    location: '0.5 mi',
    genre: ['House', 'EDM'],
    rating: 4.8,
    isLive: true,
  },
  {
    id: '2',
    name: 'DJ Beatrix',
    avatar: '',
    club: 'The Vault',
    location: '1.2 mi',
    genre: ['Hip-Hop', 'R&B'],
    rating: 4.6,
    isLive: false,
  },
  {
    id: '3',
    name: 'DJ Luna',
    avatar: '',
    club: 'Skyline Club',
    location: '2.0 mi',
    genre: ['Techno', 'Progressive'],
    rating: 4.9,
    isLive: true,
  },
];

const DiscoverDJsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [djs, setDjs] = useState<DJ[]>([]);

  useEffect(() => {
    const show = () => {
      setDjs(mockDJs);
      setLoading(false);
    };
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(show, show, { timeout: 4000 });
    } else {
      show();
    }
  }, []);

  const live = djs.filter((d) => d.isLive);
  const offline = djs.filter((d) => !d.isLive);

  const row = (dj: DJ) => (
    <li key={dj.id}>
      <button
        onClick={() => navigate('/customer')}
        className="w-full flex items-center gap-3.5 py-4 text-left border-b border-white/[0.06]"
      >
        <div className="w-12 h-12 rounded-xl bg-dark-300 shrink-0 overflow-hidden">
          {dj.avatar && <img src={dj.avatar} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold tracking-[-0.02em] truncate">{dj.name}</p>
          <p className="text-[12.5px] muted truncate">
            {dj.club} · {dj.location} · {dj.genre.join(', ')}
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
        <p className="text-[13px] muted mt-1">DJs playing near you</p>

        {loading ? (
          <p className="text-[13.5px] muted mt-8">Finding DJs…</p>
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
