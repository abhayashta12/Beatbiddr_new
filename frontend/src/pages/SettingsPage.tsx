import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
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
  const [editing, setEditing] = useState<EditField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(0);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setBalance(data.walletBalance ?? 0);
      setName(data.name ?? '');
      setDjProfile((data.djProfile as DJProfile) ?? {});
      setAvailable(data.djEarningsAvailable ?? 0);
      // Stripe's verdict, synced by the account.updated webhook — not
      // something we infer from the DJ returning to the app.
      setPayoutsEnabled(data.payoutsEnabled === true);
      setStripeAccountId(typeof data.stripeAccountId === 'string' ? data.stripeAccountId : null);
    });
  }, [user]);

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

  /** Shared plumbing for the two payout calls. */
  const callPayoutApi = async (path: string) => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Please sign in again.');
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: '{}',
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Keep Stripe's code visible — without it a payout failure is just
      // "something went wrong", which tells nobody anything.
      const detail = body.stripeCode ? ` (${body.stripeCode})` : '';
      throw new Error(`${body.error ?? 'Something went wrong.'}${detail}`);
    }
    return body;
  };

  const setUpPayouts = async () => {
    if (payoutBusy) return;
    setPayoutBusy(true);
    setError(null);
    try {
      const { url } = await callPayoutApi('/api/connect-onboard');
      if (!url) throw new Error('Could not open payout setup.');
      // Stripe-hosted onboarding. Replacing the location rather than opening a
      // tab keeps the flow in one place on a phone.
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message ?? 'Could not open payout setup.');
      setPayoutBusy(false);
    }
  };

  const cashOut = async () => {
    if (payoutBusy) return;
    setPayoutBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { amount } = await callPayoutApi('/api/request-payout');
      // The snapshot listener brings the new balance back on its own.
      setNotice(`$${Number(amount).toFixed(2)} is on its way to your bank.`);
    } catch (err: any) {
      setError(err?.message ?? 'Could not send your payout.');
    } finally {
      setPayoutBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
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
          {notice && <p className="text-[13px] text-brand-500 mb-4">{notice}</p>}

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
              </div>
            </>
          )}

          {/* ---------- money ---------- */}
          <p className="label mb-2 mt-6">Money</p>
          <div className="card divide-y divide-white/[0.07]">
            {isDJ ? (
              <>
                <Row k="Earnings" v="View" onClick={() => navigate('/dj')} />
                <Row k="Available to cash out" v={`$${available.toFixed(2)}`} accent={available > 0} />
                <div className="px-4 py-3.5">
                  <p className="text-[14px] font-semibold">Payouts</p>
                  {payoutsEnabled ? (
                    <>
                      <p className="text-[11.5px] muted mt-1 leading-relaxed">
                        Paid to your bank through Stripe. $10 minimum.
                      </p>
                      <button
                        onClick={cashOut}
                        disabled={payoutBusy || available < 10}
                        className="btn-primary w-full mt-3 py-2.5 text-[14px] disabled:opacity-40"
                      >
                        {payoutBusy
                          ? 'Sending…'
                          : available < 10
                          ? 'Minimum $10 to cash out'
                          : `Cash out $${available.toFixed(2)}`}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-[11.5px] muted mt-1 leading-relaxed">
                        {stripeAccountId
                          ? 'Stripe is still verifying your details. This can take a few minutes.'
                          : 'Connect a bank account through Stripe to get paid.'}
                      </p>
                      <button
                        onClick={setUpPayouts}
                        disabled={payoutBusy}
                        className="btn-ghost w-full mt-3 py-2.5 text-[14px] disabled:opacity-40"
                      >
                        {payoutBusy
                          ? 'Opening…'
                          : stripeAccountId
                          ? 'Continue setup'
                          : 'Set up payouts'}
                      </button>
                    </>
                  )}
                </div>
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
