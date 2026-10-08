import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * A DJ accepting, rejecting or playing a request.
 *
 * This used to be a plain updateDoc from the DJ's browser, which meant two
 * things we could not live with: any DJ could change any request, because the
 * rules had no owner to check against, and rejecting a request left the fan's
 * money gone — the Refund Policy promised it back and nothing ever returned it.
 *
 * Both are fixed here. Ownership is checked against the request's djId, and a
 * rejection refunds inside the same transaction that changes the status, so a
 * request can never end up rejected-but-unrefunded.
 */

type Status = 'pending' | 'accepted' | 'rejected' | 'played';

/** Only these moves are legal. Anything else is a no. */
const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  pending: ['accepted', 'rejected'],
  accepted: ['played', 'rejected'],
  played: [],
  rejected: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const limited = await checkRateLimit(uid, {
    action: 'request-status',
    limit: 120,
    windowSeconds: 60,
  });
  if (!limited.allowed) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res.status(429).json({ error: 'Too many updates at once. Try again shortly.' });
  }

  const { requestId, status } = req.body as { requestId?: string; status?: string };

  if (typeof requestId !== 'string' || !requestId || requestId.length > 128) {
    return res.status(400).json({ error: 'Which request?' });
  }
  if (status !== 'accepted' && status !== 'rejected' && status !== 'played') {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const db = adminDb();
  const requestRef = db.collection('songRequests').doc(requestId);
  const queueRef = db.collection('queueEntries').doc(requestId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(requestRef);
      if (!snap.exists) {
        throw Object.assign(new Error('That request no longer exists.'), { status: 404 });
      }

      const request = snap.data()!;

      // The only authorisation that matters: this request was sent to you.
      if (request.djId !== uid) {
        throw Object.assign(new Error('That request was not sent to you.'), { status: 403 });
      }

      const current = (request.status ?? 'pending') as Status;
      if (current === status) {
        // Idempotent: a double tap is not an error.
        return { status, refunded: 0 };
      }
      if (!ALLOWED_TRANSITIONS[current]?.includes(status)) {
        throw Object.assign(
          new Error(`A ${current} request cannot be marked ${status}.`),
          { status: 409 }
        );
      }

      // Every read must happen before the first write — Firestore rejects a
      // transaction that reads after writing. So work out the refund target
      // now, before touching anything.
      const tip = typeof request.tipAmount === 'number' ? request.tipAmount : 0;
      const requesterId = request.requester?.id;
      const refundable =
        status === 'rejected' &&
        tip > 0 &&
        typeof requesterId === 'string' &&
        Boolean(requesterId) &&
        requesterId !== 'deleted';

      const requesterRef = refundable ? db.collection('users').doc(requesterId) : null;
      // Nothing is written before this read completes.
      const requesterSnap = requesterRef ? await tx.get(requesterRef) : null;

      // ---- writes from here on ----
      tx.update(requestRef, { status });
      tx.set(queueRef, { status }, { merge: true });

      if (!requesterRef || !requesterSnap?.exists) {
        // Either not a rejection, nothing to give back, or the account is
        // gone. Still a valid status change.
        return { status, refunded: 0 };
      }

      tx.update(requesterRef, { walletBalance: FieldValue.increment(tip) });
      // Ledger id is derived from the request, so a retry writes the same
      // document rather than crediting twice.
      tx.set(requesterRef.collection('ledger').doc(`refund_${requestId}`), {
        type: 'refund',
        amount: tip,
        song: { title: request.song?.title ?? '', artist: request.song?.artist ?? '' },
        requestId,
        timestamp: new Date().toISOString(),
      });

      return { status, refunded: tip };
    });

    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.status ?? 500;
    if (status === 500) {
      console.error('update-request-status failed:', err.message);
      return res.status(500).json({ error: 'Could not update that request. Please try again.' });
    }
    return res.status(status).json({ error: err.message });
  }
}
