import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';
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

  const { song, tipAmount, message } = req.body as {
    song?: SongPayload;
    tipAmount?: number;
    message?: string;
  };

  if (
    !song || typeof song.id !== 'string' || typeof song.title !== 'string' ||
    typeof song.artist !== 'string' || typeof song.albumCover !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid song.' });
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
  const requestRef = db.collection('songRequests').doc();
  const ledgerRef = userRef.collection('ledger').doc();
  const timestamp = new Date().toISOString();

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw Object.assign(new Error('User not found.'), { status: 404 });

      const user = userSnap.data()!;
      if (user.role !== 'customer') {
        throw Object.assign(new Error('Only customers can request songs.'), { status: 403 });
      }
      const balance = typeof user.walletBalance === 'number' ? user.walletBalance : 0;
      if (balance < tip) {
        throw Object.assign(new Error('Insufficient wallet balance.'), { status: 402 });
      }

      tx.update(userRef, { walletBalance: FieldValue.increment(-tip) });
      tx.set(requestRef, {
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
    if (status === 500) console.error('submit-request failed:', err.message);
    return res.status(status).json({ error: err.message ?? 'Failed to submit request.' });
  }
}
