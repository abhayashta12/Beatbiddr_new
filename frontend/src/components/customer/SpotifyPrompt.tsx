import React from 'react';
import { X, Check } from 'lucide-react';
import { redirectToSpotifyLogin } from '../../utils/spotifyAuth';

const SpotifyMark: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3c-.22.36-.68.47-1.04.26-2.85-1.74-6.44-2.14-10.66-1.17-.41.09-.82-.17-.91-.58-.1-.41.16-.82.58-.91 4.62-1.06 8.59-.6 11.77 1.35.36.22.47.69.26 1.05zm1.47-3.27c-.27.44-.85.58-1.29.31-3.26-2-8.23-2.59-12.09-1.42-.5.15-1.02-.13-1.17-.62-.15-.5.13-1.02.63-1.17 4.41-1.34 9.88-.69 13.62 1.61.43.27.57.85.3 1.29zm.13-3.4C15.24 8.3 8.82 8.09 5.09 9.22c-.6.18-1.23-.16-1.41-.75-.18-.6.16-1.23.75-1.41 4.29-1.3 11.4-1.05 15.9 1.62.54.32.71 1.02.4 1.55-.32.53-1.02.71-1.55.4z" />
  </svg>
);

interface SpotifyPromptProps {
  connected: boolean;
  /** 'banner' sits on the dashboard and can be dismissed; 'inline' sits above
   *  the search field in the request sheet, where it is always relevant. */
  variant: 'banner' | 'inline';
  onDismiss?: () => void;
}

/**
 * Asks the user to connect Spotify, and says what it costs them not to.
 * The previous wording ("Connect Spotify for full search") gave no reason to
 * care and was styled as muted text, so it went unnoticed.
 */
const SpotifyPrompt: React.FC<SpotifyPromptProps> = ({ connected, variant, onDismiss }) => {
  if (connected) {
    // Once done, shrink to a quiet confirmation rather than keep selling it.
    if (variant === 'inline') return null;
    return (
      <div className="flex items-center gap-2.5 py-3.5">
        <span className="w-[18px] h-[18px] rounded-full bg-brand-500 flex items-center justify-center shrink-0">
          <Check size={11} className="text-brand-ink" strokeWidth={3.5} />
        </span>
        <span className="text-[12.5px] muted">Spotify connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/30">
      <span className="w-9 h-9 rounded-full bg-brand-500 text-brand-ink flex items-center justify-center shrink-0">
        <SpotifyMark size={21} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold tracking-[-0.01em] leading-tight">
          Connect Spotify
        </p>
        <p className="text-[11.5px] muted mt-0.5">
          {variant === 'inline' ? 'Only 3 songs without it' : 'Search millions of tracks'}
        </p>
      </div>

      <button
        onClick={() => redirectToSpotifyLogin()}
        className="text-[12.5px] font-bold text-brand-500 px-2 py-1 shrink-0 hover:text-brand-400 transition-colors"
      >
        Connect
      </button>

      {variant === 'banner' && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-neutral-600 hover:text-neutral-400 -mr-1 shrink-0 transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default SpotifyPrompt;
