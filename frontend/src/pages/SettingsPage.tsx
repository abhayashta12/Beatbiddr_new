import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { clearSpotifyToken, getValidSpotifyToken, redirectToSpotifyLogin } from '../utils/spotifyAuth';
import EditFieldSheet, { type EditField } from '../components/settings/EditFieldSheet';
import DeleteAccountSheet from '../components/settings/DeleteAccountSheet';

interface DJProfile {
  username?: string;
  stageName?: string;
  legalName?: string;
  phone?: string;
  address?: string;
  club?: string;
  isLive?: boolean;
}

const SettingsPage: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const isDJ = role === 'dj';

  const [balance, setBalance] = useState(0);
  const [name, setName] = useState('');
  const [djProfile, setDjProfile] = useState<DJProfile>({});
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [editing, setEditing] = useState<EditField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setBalance(data.walletBalance ?? 0);
      setName(data.name ?? '');
      setDjProfile((data.djProfile as DJProfile) ?? {});
    });
  }, [user]);

  useEffect(() => {
    getValidSpotifyToken().then((t) => setSpotifyConnected(Boolean(t)));
  }, []);

  /** name lives outside the server-only fields, so the client may write it. */
  const saveName = async (value: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { name: value });
  };

  /** djProfile is server-only — edits go through the API. */
  const saveDjField = async (field: string, value: string) => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not signed in.');
    const res = await fetch('/api/update-dj-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const { error: serverError } = await res.json().catch(() => ({ error: null }));
      throw new Error(serverError ?? 'Could not save your changes.');
    }
  };

  const toggleLive = async () => {
    if (liveBusy) return;
    setLiveBusy(true);
    setError(null);
    const next = !djProfile.isLive;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in.');
      const res = await fetch('/api/update-dj-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ isLive: next }),
      });
      if (!res.ok) {
        const { error: serverError } = await res.json().catch(() => ({ error: null }));
        throw new Error(serverError ?? 'Could not update.');
      }
      // The snapshot listener carries the new value back
    } catch (err: any) {
      setError(err.message ?? 'Could not update.');
    } finally {
      setLiveBusy(false);
    }
  };

  const handleLogout = async () => {
    clearSpotifyToken();
    await logout();
    navigate('/');
  };

  const handleSpotify = () => {
    if (spotifyConnected) {
      clearSpotifyToken();
      setSpotifyConnected(false);
    } else {
      redirectToSpotifyLogin();
    }
  };

  return (
    <div className="app-shell bg-dark-600">
      <div className="app-scroll safe-top">
        <div className="px-6 pt-4 pb-10">
          <div className="flex items-center gap-2 mb-5 -ml-2">
            <button
              onClick={() => navigate('/profile')}
              aria-label="Back"
              className="p-2 text-neutral-400 hover:text-white"
            >
              <ChevronLeft size={21} />
            </button>
            <h1 className="text-[21px] font-extrabold tracking-[-0.035em]">Settings</h1>
          </div>

          {error && <p className="text-[13px] text-red-400 mb-4">{error}</p>}

          {/* ---------- profile ---------- */}
          <p className="label mb-2">Profile</p>
          <div className="card divide-y divide-white/[0.07]">
            <Row
              k="Display name"
              v={name || '—'}
              onClick={() =>
                setEditing({
                  key: 'name',
                  label: 'Display name',
                  value: name,
                  maxLength: 60,
                  onSave: saveName,
                })
              }
            />
            <Row k="Email" v={user?.email ?? '—'} locked="Google" />
            <Row k="Account type" v={isDJ ? 'DJ / Artist' : 'Music Fan'} locked="Locked" />
          </div>

          {/* ---------- DJ profile ---------- */}
          {isDJ && (
            <>
              <p className="label mb-2 mt-6">DJ profile</p>
              <div className="card divide-y divide-white/[0.07]">
                <Row k="Username" v={djProfile.username ? `@${djProfile.username}` : '—'} locked="Permanent" />
                <Row
                  k="Stage name"
                  v={djProfile.stageName || '—'}
                  onClick={() =>
                    setEditing({
                      key: 'stageName',
                      label: 'Stage name',
                      value: djProfile.stageName ?? '',
                      maxLength: 50,
                      onSave: (v) => saveDjField('stageName', v),
                    })
                  }
                />
                <Row
                  k="Venue"
                  v={djProfile.club || 'Not set'}
                  onClick={() =>
                    setEditing({
                      key: 'club',
                      label: 'Venue',
                      value: djProfile.club ?? '',
                      maxLength: 100,
                      optional: true,
                      onSave: (v) => saveDjField('club', v),
                    })
                  }
                />
                <Row
                  k="Phone"
                  v={djProfile.phone || '—'}
                  onClick={() =>
                    setEditing({
                      key: 'phone',
                      label: 'Phone number',
                      value: djProfile.phone ?? '',
                      maxLength: 20,
                      inputMode: 'tel',
                      onSave: (v) => saveDjField('phone', v),
                    })
                  }
                />
                <Row
                  k="Address"
                  v={djProfile.address || '—'}
                  onClick={() =>
                    setEditing({
                      key: 'address',
                      label: 'Address',
                      value: djProfile.address ?? '',
                      maxLength: 200,
                      onSave: (v) => saveDjField('address', v),
                    })
                  }
                />
              </div>

              <p className="label mb-2 mt-6">Playing</p>
              <div className="card divide-y divide-white/[0.07]">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">Live now</p>
                    <p className="text-[11.5px] muted mt-0.5">Show up in Discover</p>
                  </div>
                  <button
                    onClick={toggleLive}
                    disabled={liveBusy}
                    role="switch"
                    aria-checked={Boolean(djProfile.isLive)}
                    aria-label="Live now"
                    className={`ml-auto w-[46px] h-[27px] rounded-full p-[3px] flex transition-colors shrink-0 ${
                      djProfile.isLive ? 'bg-brand-500 justify-end' : 'bg-dark-200 justify-start'
                    } ${liveBusy ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`w-[21px] h-[21px] rounded-full block ${
                        djProfile.isLive ? 'bg-brand-ink' : 'bg-neutral-500'
                      }`}
                    />
                  </button>
                </div>
                <Row k="Auto-accept above" v="Soon" muted />
              </div>
            </>
          )}

          {/* ---------- connections ---------- */}
          <p className="label mb-2 mt-6">Connections</p>
          <div className="card divide-y divide-white/[0.07]">
            <Row
              k="Spotify"
              v={spotifyConnected ? 'Connected' : 'Not connected'}
              accent={spotifyConnected}
              onClick={handleSpotify}
            />
          </div>

          {/* ---------- money ---------- */}
          <p className="label mb-2 mt-6">Money</p>
          <div className="card divide-y divide-white/[0.07]">
            {isDJ ? (
              <>
                <Row k="Payouts" v="Soon" muted />
                <Row k="Earnings" v="View" onClick={() => navigate('/dj')} />
              </>
            ) : (
              <Row
                k="Wallet & transactions"
                v={`$${balance.toFixed(2)}`}
                onClick={() => navigate('/wallet')}
              />
            )}
          </div>

          {/* ---------- about ---------- */}
          <p className="label mb-2 mt-6">About</p>
          <div className="card divide-y divide-white/[0.07]">
            <Row k="Terms of Service" v="" onClick={() => navigate('/legal/terms')} />
            <Row k="Privacy Policy" v="" onClick={() => navigate('/legal/privacy')} />
            <Row k="Refund Policy" v="" onClick={() => navigate('/legal/refunds')} />
          </div>

          {/* ---------- account ---------- */}
          <p className="label mb-2 mt-6">Account</p>
          <div className="card divide-y divide-white/[0.07]">
            <Row k="Log out" v="" onClick={handleLogout} />
            <button
              onClick={() => setDeleting(true)}
              className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
            >
              <span className="text-[14px] font-semibold text-red-400">Delete account</span>
              <ChevronRight size={16} className="ml-auto text-neutral-600 shrink-0" />
            </button>
          </div>

          <p className="text-[11.5px] muted mt-6 text-center">BeatBiddr</p>
        </div>
      </div>

      <EditFieldSheet field={editing} onClose={() => setEditing(null)} />
      <DeleteAccountSheet
        open={deleting}
        balance={balance}
        isDJ={isDJ}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
};

/* ---------- one settings row ---------- */
const Row: React.FC<{
  k: string;
  v: string;
  locked?: string;
  muted?: boolean;
  accent?: boolean;
  onClick?: () => void;
}> = ({ k, v, locked, muted, accent, onClick }) => {
  const body = (
    <>
      <span className="text-[14px] font-semibold shrink-0">{k}</span>
      <span className="ml-auto flex items-center gap-2 min-w-0">
        {v && (
          <span
            className={`text-[13px] truncate ${
              accent ? 'text-brand-500' : muted ? 'text-neutral-600' : 'text-neutral-400'
            }`}
          >
            {v}
          </span>
        )}
        {locked ? (
          <span className="text-[10.5px] text-neutral-600 shrink-0">{locked}</span>
        ) : onClick ? (
          <ChevronRight size={16} className="text-neutral-600 shrink-0" />
        ) : null}
      </span>
    </>
  );

  if (!onClick) {
    return <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>;
  }
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-4 py-3.5 w-full text-left">
      {body}
    </button>
  );
};

export default SettingsPage;
