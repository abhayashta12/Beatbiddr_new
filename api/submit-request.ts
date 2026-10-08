import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';

interface SongPayload {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumCover: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Generous enough for an enthusiastic night out, tight enough that a script
  // cannot spam a DJ's queue or drain a wallet in a loop.
  const limited = await checkRateLimit(uid, {
    action: 'submit-request',
    limit: 20,
    windowSeconds: 300,
  });
  if (!limited.allowed) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res
      .status(429)
      .json({ error: 'That is a lot of requests. Give it a few minutes.' });
  }

  const { djId, song, tipAmount, message } = req.body as {
    djId?: string;
    song?: SongPayload;
    tipAmount?: number;
    message?: string;
  };

  if (typeof djId !== 'string' || !djId || djId.length > 128) {
    return res.status(400).json({ error: 'Choose a DJ first.' });
  }

  if (
    !song || typeof song.id !== 'string' || typeof song.title !== 'string' ||
    typeof song.artist !== 'string' || typeof song.albumCover !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid song.' });
  }
  // The client sends these, so cap them — otherwise a crafted request could
  // store megabytes per document and run up storage against the project.
  if (
    song.id.length > 100 ||
    song.title.length > 300 ||
    song.artist.length > 300 ||
    song.albumCover.length > 500 ||
    (song.album !== undefined && (typeof song.album !== 'string' || song.album.length > 300))
  ) {
    return res.status(400).json({ error: 'Song details are too long.' });
  }
  if (typeof tipAmount !== 'number' || !Number.isFinite(tipAmount) || tipAmount < 1 || tipAmount > 1000) {
    return res.status(400).json({ error: 'Tip must be between $1 and $1000.' });
  }
  if (message !== undefined && (typeof message !== 'string' || message.length > 500)) {
    return res.status(400).json({ error: 'Message too long.' });
  }

  const tip = Math.round(tipAmount * 100) / 100;
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const djRef = db.collection('djs').doc(djId);
  const requestRef = db.collection('songRequests').doc();
  const ledgerRef = userRef.collection('ledger').doc();
  // Identity-free mirror so a fan can work out their queue position without
  // being able to read other people's names or messages.
  const queueRef = db.collection('queueEntries').doc(requestRef.id);
  const timestamp = new Date().toISOString();

  try {
    await db.runTransaction(async (tx) => {
      const [userSnap, djSnap] = await Promise.all([tx.get(userRef), tx.get(djRef)]);
      if (!userSnap.exists) throw Object.assign(new Error('User not found.'), { status: 404 });

      // The DJ must actually exist. Without this check a crafted request could
      // park rows under any djId, including one that is simply made up.
      if (!djSnap.exists) {
        throw Object.assign(new Error('That DJ is no longer available.'), { status: 404 });
      }

      const user = userSnap.data()!;
      if (user.role !== 'customer') {
        throw Object.assign(new Error('Only customers can request songs.'), { status: 403 });
      }
      const balance = typeof user.walletBalance === 'number' ? user.walletBalance : 0;
      if (balance < tip) {
        throw Object.assign(new Error('Insufficient wallet balance.'), { status: 402 });
      }

      tx.update(userRef, { walletBalance: FieldValue.increment(-tip) });
      tx.set(queueRef, {
        djId,
        status: 'pending',
        tipAmount: tip,
        title: song.title,
        artist: song.artist,
        timestamp,
      });
      tx.set(requestRef, {
        djId,
        song: {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album ?? '',
          albumCover: song.albumCover,
        },
        requester: {
          id: uid,
          name: user.name ?? 'Anonymous',
          avatar: user.avatar ?? '',
        },
        tipAmount: tip,
        message: message ?? '',
        status: 'pending',
        timestamp,
      });
      tx.set(ledgerRef, {
        type: 'tip',
        amount: tip,
        song: { title: song.title, artist: song.artist },
        requestId: requestRef.id,
        timestamp,
      });
    });

    return res.status(200).json({ requestId: requestRef.id });
  } catch (err: any) {
    const status = err.status ?? 500;
    if (status === 500) {
      // Internal failures are logged but never echoed back — the underlying
      // message can name collection paths and other internals.
      console.error('submit-request failed:', err.message);
      return res.status(500).json({ error: 'Could not send your request. Please try again.' });
    }
    // Deliberate, user-facing messages only (insufficient balance, wrong role)
    return res.status(status).json({ error: err.message });
  }
}
