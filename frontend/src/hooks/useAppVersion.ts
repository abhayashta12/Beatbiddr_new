import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
// After "Later", stay quiet for a while rather than nagging on every check.
const SNOOZE_MS = 30 * 60 * 1000;

/**
 * Detects when a newer build has been deployed while this tab has been open.
 *
 * A single-page app never re-requests index.html after it loads, so a long-lived
 * tab can keep running an old bundle indefinitely — against a server and
 * security rules that have since moved on. That mismatch surfaces to the user as
 * unexplained permission or validation errors. Comparing the build this bundle
 * was compiled from against the currently deployed one lets us offer a reload
 * instead.
 */
export const useAppVersion = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const snoozedUntil = useRef(0);

  const checkVersion = useCallback(async () => {
    // Local dev builds aren't stamped, so there is nothing meaningful to compare.
    if (__APP_VERSION__ === 'dev') return;
    if (Date.now() < snoozedUntil.current) return;

    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { version } = (await res.json()) as { version?: string };
      if (version && version !== 'dev' && version !== __APP_VERSION__) {
        setUpdateAvailable(true);
      }
    } catch {
      // Offline or a transient failure — try again on the next tick.
    }
  }, []);

  useEffect(() => {
    checkVersion();

    const interval = setInterval(checkVersion, POLL_INTERVAL_MS);

    // Returning to the tab is the moment that matters most: the user is about to
    // do something, and this is our last chance to catch a stale bundle first.
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', checkVersion);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', checkVersion);
    };
  }, [checkVersion]);

  const snooze = useCallback(() => {
    snoozedUntil.current = Date.now() + SNOOZE_MS;
    setUpdateAvailable(false);
  }, []);

  /** Drops any cached assets, then reloads so the new index.html is fetched. */
  const reload = useCallback(async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Cache Storage unavailable (private mode, older browsers) — reload anyway.
    }
    window.location.reload();
  }, []);

  return { updateAvailable, reload, snooze };
};
