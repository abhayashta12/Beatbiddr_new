import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useAppVersion } from '../../hooks/useAppVersion';

/**
 * Prompts the user to reload when a newer build has been deployed. Deliberately
 * a prompt rather than an automatic reload — refreshing underneath someone
 * mid-payment or mid-form would lose their input.
 */
const UpdateBanner: React.FC = () => {
  const { updateAvailable, reload, snooze } = useAppVersion();
  const [reloading, setReloading] = useState(false);

  const handleReload = () => {
    setReloading(true);
    reload();
  };

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3 }}
          role="status"
          aria-live="polite"
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:max-w-sm z-[100]"
        >
          <div className="bg-dark-500/95 backdrop-blur-md border border-primary-500/30 rounded-xl shadow-2xl p-4 flex items-start gap-3">
            <div className="bg-primary-500/20 rounded-full p-2 shrink-0">
              <Sparkles size={18} className="text-primary-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">A new version is available</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Refresh to get the latest version of BeatBiddr.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleReload}
                  disabled={reloading}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center disabled:opacity-60"
                >
                  <RefreshCw
                    size={14}
                    className={`mr-1.5 ${reloading ? 'animate-spin' : ''}`}
                  />
                  {reloading ? 'Refreshing…' : 'Refresh now'}
                </button>
                <button
                  onClick={snooze}
                  className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1.5 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateBanner;
