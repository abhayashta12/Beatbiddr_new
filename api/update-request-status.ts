import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';
import { planStatusChange } from './_lib/requestStatus';

/**
 * BeatBiddr's cut of a tip, as a percentage. Unset means 0 — the DJ keeps
 * everything — so turning on a fee is a config change, not a deploy.
 */
function platformFeePercent(): number {
  const raw = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);
  return Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
}

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
      const plan = planStatusChange(request, uid, status, platformFeePercent());

      if (plan.error) {
        throw Object.assign(new Error(plan.error.message), { status: plan.error.status });
      }
      if (plan.idempotent) {
        return { status, released: 0, captured: 0, earned: 0 };
      }

      // Every read must happen before the first write — Firestore rejects a
      // transaction that reads after writing. So resolve the fan now.
      const settle = plan.capture ?? plan.release;
      const requesterRef = settle ? db.collection('users').doc(settle.requesterId) : null;
      const requesterSnap = requesterRef ? await tx.get(requesterRef) : null;
      const requesterExists = Boolean(requesterSnap?.exists);

      // Never move more than is actually held. A request created before holds
      // existed has no hold behind it, and blindly decrementing would push
      // walletHeld negative — which would then let the fan's next release
      // mint money that was never there.
      const heldNow = (() => {
        const v = requesterSnap?.data()?.walletHeld;
        return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
      })();
      const settleAmount = settle ? Math.min(settle.amount, heldNow) : 0;

      // ---- writes from here on ----
      tx.update(requestRef, { status });
      tx.set(queueRef, { status }, { merge: true });

      const song = { title: request.song?.title ?? '', artist: request.song?.artist ?? '' };

      // Rejected: the hold goes straight back to spendable. The fan never
      // paid, so there is nothing to record in the ledger.
      if (plan.release && requesterRef && requesterExists) {
        if (settleAmount > 0) {
          tx.update(requesterRef, {
            walletHeld: FieldValue.increment(-settleAmount),
            walletBalance: FieldValue.increment(settleAmount),
          });
        }
        return { status, released: settleAmount, captured: 0, earned: 0 };
      }

      // Accepted: the hold is now spent. This is the moment the fan actually
      // pays and the DJ actually earns.
      if (plan.capture && requesterRef && requesterExists) {
        if (settleAmount > 0) {
          tx.update(requesterRef, { walletHeld: FieldValue.increment(-settleAmount) });
        }
        // Ledger id derives from the request, so a retry rewrites the same
        // document instead of recording a second charge.
        tx.set(requesterRef.collection('ledger').doc(`tip_${requestId}`), {
          type: 'tip',
          amount: plan.capture.amount,
          song,
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      if (plan.earning) {
        const djRef = db.collection('users').doc(plan.earning.djId);
        tx.update(djRef, {
          djEarningsAvailable: FieldValue.increment(plan.earning.net),
          djEarningsLifetime: FieldValue.increment(plan.earning.net),
        });
        tx.set(djRef.collection('earnings').doc(`tip_${requestId}`), {
          type: 'tip',
          gross: plan.earning.gross,
          fee: plan.earning.fee,
          net: plan.earning.net,
          requestId,
          song,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        status,
        released: 0,
        captured: plan.capture?.amount ?? 0,
        earned: plan.earning?.net ?? 0,
      };
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
