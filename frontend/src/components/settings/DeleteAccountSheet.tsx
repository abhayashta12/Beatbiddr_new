import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { clearSpotifyToken } from '../../utils/spotifyAuth';

interface DeleteAccountSheetProps {
  open: boolean;
  balance: number;
  isDJ: boolean;
  onClose: () => void;
}

const CONFIRM_WORD = 'DELETE';

/**
 * Permanent account deletion. Typing the confirmation word is deliberate
 * friction — this cannot be undone, and an unspent balance is forfeited.
 */
const DeleteAccountSheet: React.FC<DeleteAccountSheetProps> = ({
  open,
  balance,
  isDJ,
  onClose,
}) => {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setTyped('');
      setError(null);
      setWorking(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !working && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, working, onClose]);

  if (!open) return null;

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!confirmed || working) return;
    setWorking(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Not signed in.');

      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ confirm: CONFIRM_WORD }),
      });

      if (!res.ok) {
        const { error: serverError } = await res.json().catch(() => ({ error: null }));
        throw new Error(serverError ?? 'Could not delete your account.');
      }

      // The auth user is gone server-side; clear the local session too so the
      // app does not sit holding a token for an account that no longer exists.
      clearSpotifyToken();
      await logout().catch(() => {});
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Could not delete your account. Please try again.');
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={() => !working && onClose()}
        className="absolute inset-0 bg-black/75"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete your account"
        className="relative bg-dark-500 rounded-t-3xl animate-sheet-up motion-reduce:animate-none
                   p-5 pt-3 flex flex-col gap-4 safe-bottom max-h-[90dvh] overflow-y-auto"
      >
        <div className="w-9 h-1 rounded-full bg-white/15 mx-auto" />

        <h2 className="text-[19px] font-extrabold tracking-[-0.03em]">Delete your account?</h2>

        <p className="text-[13.5px] muted leading-relaxed">
          This permanently removes your profile and request history
          {isDJ ? ', and frees your DJ username for someone else' : ''}. It cannot be undone.
        </p>

        {balance > 0 && (
          <div className="flex gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25">
            <AlertTriangle size={17} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-400 leading-relaxed">
              Your ${balance.toFixed(2)} balance will not be refunded. Spend it before deleting.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="confirm-delete" className="label">
            Type {CONFIRM_WORD} to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="input w-full mt-2.5 tracking-[0.1em]"
          />
        </div>

        {error && <p className="text-[13px] text-red-400 leading-relaxed">{error}</p>}

        <button
          onClick={handleDelete}
          disabled={!confirmed || working}
          className="btn w-full bg-red-500/15 text-red-400 hover:bg-red-500/25
                     flex items-center justify-center disabled:opacity-40"
        >
          {working ? <Loader2 size={18} className="animate-spin" /> : 'Delete permanently'}
        </button>

        <button onClick={onClose} disabled={working} className="btn-ghost w-full">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DeleteAccountSheet;
