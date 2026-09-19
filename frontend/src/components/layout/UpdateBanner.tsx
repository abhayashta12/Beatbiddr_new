import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useAppVersion } from '../../hooks/useAppVersion';

/**
 * Prompts a reload when a newer build has been deployed. Deliberately a prompt
 * rather than an automatic refresh — reloading underneath someone mid-payment
 * or mid-form would lose their input.
 */
const UpdateBanner: React.FC = () => {
  const { updateAvailable, reload, snooze } = useAppVersion();
  const [reloading, setReloading] = useState(false);

  if (!updateAvailable) return null;

  const handleReload = () => {
    setReloading(true);
    reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-[100]
                 animate-rise motion-reduce:animate-none"
    >
      <div className="bg-dark-400 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="bg-brand-500/15 rounded-full p-2 shrink-0">
          <Sparkles size={18} className="text-brand-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] tracking-[-0.01em]">A new version is available</p>
          <p className="text-[12.5px] text-neutral-400 mt-0.5">
            Refresh to get the latest version of BeatBiddr.
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleReload}
              disabled={reloading}
              className="btn-primary py-2 px-3.5 text-[13px] rounded-xl flex items-center disabled:opacity-60"
            >
              <RefreshCw size={14} className={`mr-1.5 ${reloading ? 'animate-spin' : ''}`} />
              {reloading ? 'Refreshing…' : 'Refresh now'}
            </button>
            <button
              onClick={snooze}
              className="text-[13px] font-semibold text-neutral-400 hover:text-white px-2 py-2 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
