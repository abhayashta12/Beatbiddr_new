import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Loader2, ArrowRight } from 'lucide-react';
import { searchSpotify } from '../../utils/spotifyApi';
import SpotifyPrompt from './SpotifyPrompt';
import type { Song } from '../../types';

interface RequestSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (song: Song, tipAmount: number, message: string) => Promise<void>;
  spotifyToken: string | null;
  balance: number;
}

// Mirrors the server's own limits in /api/submit-request
const MIN_TIP = 1;
const MAX_TIP = 1000;
const TIP_PRESETS = [5, 10, 20, 50];

const FALLBACK_SONGS: Song[] = [
  { id: 'f1', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', albumCover: '' },
  { id: 'f2', title: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', albumCover: '' },
  { id: 'f3', title: 'One Kiss', artist: 'Calvin Harris, Dua Lipa', album: 'One Kiss', albumCover: '' },
];

/**
 * Requesting happens in a sheet rather than on the page: it keeps every control
 * within thumb reach, and it rides above the keyboard when a field is focused.
 */
const RequestSheet: React.FC<RequestSheetProps> = ({
  open,
  onClose,
  onSubmit,
  spotifyToken,
  balance,
}) => {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Song | null>(null);
  const [tipText, setTipText] = useState('10');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { tip, tipValid, tipProblem } = useMemo(() => {
    const parsed = Number.parseFloat(tipText);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { tip: 0, tipValid: false, tipProblem: null as string | null };
    }
    if (parsed < MIN_TIP) return { tip: parsed, tipValid: false, tipProblem: `Minimum tip is $${MIN_TIP}.` };
    if (parsed > MAX_TIP)
      return { tip: parsed, tipValid: false, tipProblem: `Maximum tip is $${MAX_TIP.toLocaleString()}.` };
    return { tip: Math.round(parsed * 100) / 100, tipValid: true, tipProblem: null };
  }, [tipText]);

  const shortBy = tipValid ? tip - balance : 0;
  // Only meaningful once a song is chosen — otherwise the button would offer to
  // top up while its label still asked for a song.
  const needsFunds = Boolean(selected) && tipValid && shortBy > 0;

  const handleTipChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const next =
      parts.length > 2
        ? `${parts[0]}.${parts.slice(1).join('')}`
        : parts[1] !== undefined
        ? `${parts[0]}.${parts[1].slice(0, 2)}`
        : parts[0];
    setTipText(next.slice(0, 7));
  };

  // Reset whenever the sheet is dismissed so it never reopens half-filled
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setTipText('10');
      setMessage('');
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      if (spotifyToken) {
        setResults(await searchSpotify(spotifyToken, q));
      } else {
        setResults(
          FALLBACK_SONGS.filter((s) =>
            `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase())
          )
        );
      }
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePrimaryAction = async () => {
    // Not enough in the wallet — send them to top up rather than stranding
    // them on a button that looks tappable but does nothing.
    if (needsFunds) {
      onClose();
      navigate('/wallet');
      return;
    }
    if (!selected || !tipValid || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(selected, tip, message);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const actionDisabled = submitting || (!needsFunds && (!selected || !tipValid));

  const actionLabel = () => {
    if (!selected) return 'Pick a song first';
    if (!tipValid) return tipProblem ? 'Choose a valid tip' : 'Enter a tip amount';
    if (needsFunds) return `Add $${shortBy.toFixed(2)} to your wallet`;
    return `Pay $${tip.toFixed(2)} & request`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request a song"
        className="relative bg-dark-500 rounded-t-3xl animate-sheet-up motion-reduce:animate-none
                   max-h-[90dvh] flex flex-col safe-bottom"
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/15 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <h2 className="text-[19px] font-extrabold tracking-[-0.03em] mt-3">Request a song</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="mt-3 p-1.5 -mr-1.5 text-neutral-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-5 pt-2 overflow-y-auto overscroll-contain flex flex-col gap-4">
          {/* Caught here too: this is the moment someone discovers search only
              knows three songs without Spotify. */}
          {!spotifyToken && <SpotifyPrompt connected={false} variant="inline" />}

          {/* search */}
          <div className="relative">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
            />
            <input
              id="song-search"
              type="search"
              className="input w-full pl-11 pr-20"
              placeholder={spotifyToken ? 'Search Spotify' : 'Search songs'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyUp={(e) => e.key === 'Enter' && runSearch()}
            />
            <button
              onClick={runSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 text-[13px] font-bold text-white"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* results */}
          {results.length > 0 && !selected && (
            <div className="flex flex-col -mx-1">
              {results.slice(0, 6).map((song) => (
                <button
                  key={song.id}
                  onClick={() => setSelected(song)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left"
                >
                  <div className="w-11 h-11 rounded-lg bg-dark-300 shrink-0 overflow-hidden">
                    {song.albumCover && (
                      <img src={song.albumCover} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold truncate tracking-[-0.01em]">
                      {song.title}
                    </p>
                    <p className="text-[12.5px] muted truncate">{song.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* chosen song */}
          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04]">
              <div className="w-12 h-12 rounded-lg bg-dark-300 shrink-0 overflow-hidden">
                {selected.albumCover && (
                  <img src={selected.albumCover} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold truncate tracking-[-0.01em]">
                  {selected.title}
                </p>
                <p className="text-[12.5px] muted truncate">{selected.artist}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-[12.5px] font-semibold text-neutral-500 hover:text-white px-2"
              >
                Change
              </button>
            </div>
          )}

          {/* tip — typeable, presets are shortcuts */}
          <div>
            <p className="label mb-2.5">Tip amount</p>

            <label htmlFor="tip-amount" className="sr-only">
              Tip amount in dollars
            </label>
            <div
              className={`flex items-center justify-center gap-0.5 py-2 border-b-2 transition-colors ${
                tipProblem ? 'border-red-500/70' : 'border-white/15 focus-within:border-brand-500'
              }`}
            >
              <span className="text-[20px] font-bold text-neutral-400 self-start mt-1">$</span>
              <input
                id="tip-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={tipText}
                onChange={(e) => handleTipChange(e.target.value)}
                onFocus={(e) => e.target.select()}
                aria-invalid={Boolean(tipProblem)}
                className="bg-transparent border-0 outline-none text-center text-[38px] font-extrabold
                           tracking-[-0.045em] leading-none tnum w-[4.4ch] p-0 text-white"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3.5">
              {TIP_PRESETS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTipText(String(amount))}
                  className={`py-2.5 rounded-xl text-[14.5px] font-bold tnum transition-colors ${
                    tipValid && tip === amount
                      ? 'bg-brand-500 text-brand-ink'
                      : 'border border-white/12 text-neutral-400 hover:text-white'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            <p className={`text-[12.5px] mt-2.5 ${tipProblem ? 'text-red-400' : 'muted'}`}>
              {tipProblem ?? 'Higher tips get played sooner.'}
            </p>
          </div>

          {/* message */}
          <div>
            <p className="label mb-2.5">Message to DJ · optional</p>
            <input
              id="dj-message"
              type="text"
              maxLength={200}
              className="input w-full"
              placeholder="Birthday shout-out…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* action */}
          <button
            onClick={handlePrimaryAction}
            disabled={actionDisabled}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-1"
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {actionLabel()}
                {needsFunds && selected && <ArrowRight size={16} />}
              </>
            )}
          </button>

          <p className="text-[12px] muted text-center -mt-1">
            {needsFunds
              ? `Balance $${balance.toFixed(2)} — not enough for a $${tip.toFixed(2)} tip`
              : `Balance after this request: $${Math.max(0, balance - (tipValid ? tip : 0)).toFixed(2)}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RequestSheet;
