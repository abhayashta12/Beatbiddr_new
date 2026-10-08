const KEY = 'beatbiddr_dj';

/**
 * Which DJ the fan is currently with.
 *
 * Kept in localStorage because it should survive a reload — someone in a club
 * backgrounds the app constantly — but it is not sensitive and not worth a
 * round trip. Every access is guarded: localStorage throws in a private
 * window and in some embedded browsers.
 */

export function getSelectedDJ(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setSelectedDJ(uid: string): void {
  try {
    localStorage.setItem(KEY, uid);
  } catch {
    // A fan with storage blocked just picks their DJ again next visit.
  }
}

export function clearSelectedDJ(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
