import { auth } from '../lib/firebase';
import type { Song } from '../types';

/**
 * Searches songs through our own API, which holds the Spotify credentials.
 *
 * Nobody connects a Spotify account — search is app-level, so it works for
 * every signed-in user from the first tap.
 */
export async function searchSongs(query: string, signal?: AbortSignal): Promise<Song[]> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Please sign in again to search.');

  const res = await fetch(`/api/search-songs?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal,
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: null }));
    throw new Error(error ?? 'Could not search songs right now.');
  }

  const { songs } = (await res.json()) as { songs: Song[] };
  return songs;
}
