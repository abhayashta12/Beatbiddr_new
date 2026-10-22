/**
 * Pure input validators, with no imports.
 *
 * Kept deliberately dependency-free. Validators that lived next to handler
 * code could not be unit tested at all: importing the handler pulled in the
 * Firebase Admin SDK, and one of its transitive dependencies is ESM-only, so
 * the test runner failed before reaching a single assertion.
 *
 * Anything in here must stay importable by a test with nothing else loaded.
 */

/**
 * True only for an image served by Spotify's own CDN over https.
 *
 * albumCover arrives from the client and is rendered in an <img> on the DJ's
 * dashboard. Unvalidated, a crafted request could point it at any host and
 * quietly collect the DJ's IP address and user-agent — and act as a read
 * receipt for exactly when they opened their queue.
 *
 * The check parses the URL and compares the hostname, rather than matching
 * the string. A substring check would accept `https://i.scdn.co.evil.com/x`
 * and `https://evil.com/?host=i.scdn.co`, which is how this kind of allowlist
 * usually fails.
 */
export function isSpotifyImageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;

  // A userinfo field lets an attacker put a trusted-looking name before an @.
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  return host === 'scdn.co' || host.endsWith('.scdn.co');
}
