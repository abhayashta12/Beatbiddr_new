import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb } from './_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Releases tips held by requests a DJ never answered.
 *
 * Without this, a fan's money sits held indefinitely the moment a DJ stops
 * tapping accept or reject — which, at 2am at the end of a set, is the normal
 * case rather than the exception. The fan was never charged, because nobody
 * ever accepted, so the money is theirs and must go back.
 *
 * Run on a schedule (see "crons" in vercel.json). Not callable by users:
 * Vercel signs its own cron invocations, and a CRON_SECRET is required
 * otherwise, so this cannot be triggered from a browser.
 */

/** A night is over well inside this. Generous so a slow DJ is not punished. */
const STALE_AFTER_HOURS = 12;
const PAGE_SIZE = 100;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorisedCron(req)) {
    // Deliberately 404, not 403: an unauthenticated caller learns nothing
    // about whether this endpoint exists.
    return res.status(404).json({ error: 'Not found' });
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000).toISOString();
  const db = adminDb();

  let released = 0;
  let refundedTotal = 0;
  let failed = 0;

  try {
    for (;;) {
      // timestamp is an ISO string, so a lexical comparison is chronological.
      const page = await db
        .collection('songRequests')
        .where('status', '==', 'pending')
        .where('timestamp', '<', cutoff)
        .limit(PAGE_SIZE)
        .get();

      if (page.empty) break;

      for (const docSnap of page.docs) {
        const request = docSnap.data();
        const tip = typeof request.tipAmount === 'number' ? request.tipAmount : 0;
        const requesterId = request.requester?.id;
        const creditable =
          tip > 0 &&
          typeof requesterId === 'string' &&
          Boolean(requesterId) &&
          requesterId !== 'deleted';

        try {
          await db.runTransaction(async (tx) => {
            // Re-read: the DJ may have answered since the query ran.
            const fresh = await tx.get(docSnap.ref);
            if (!fresh.exists || fresh.data()?.status !== 'pending') return;

            const fanRef = creditable
              ? db.collection('users').doc(requesterId as string)
              : null;
            const fanSnap = fanRef ? await tx.get(fanRef) : null;

            // ---- writes ----
            tx.update(docSnap.ref, { status: 'rejected', expiredAt: new Date().toISOString() });
            tx.set(
              db.collection('queueEntries').doc(docSnap.id),
              { status: 'rejected' },
              { merge: true }
            );

            if (fanRef && fanSnap?.exists) {
              const heldRaw = fanSnap.data()?.walletHeld;
              const held = typeof heldRaw === 'number' && heldRaw > 0 ? heldRaw : 0;
              const amount = Math.min(tip, held);
              if (amount > 0) {
                tx.update(fanRef, {
                  walletHeld: FieldValue.increment(-amount),
                  walletBalance: FieldValue.increment(amount),
                });
                refundedTotal += amount;
              }
            }

            released += 1;
          });
        } catch (err: any) {
          // Keep going: the rest of the page is other people's money.
          failed += 1;
          console.error(`release-stale-holds: ${docSnap.id} failed:`, err.message);
        }
      }

      if (page.size < PAGE_SIZE) break;
    }

    console.log(
      `release-stale-holds: released ${released}, returned $${refundedTotal.toFixed(2)}, ${failed} failed.`
    );
    return res.status(200).json({ released, refundedTotal, failed });
  } catch (err: any) {
    console.error('release-stale-holds failed:', err.message);
    return res.status(500).json({ error: 'Sweep failed.' });
  }
}

/**
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled
 * invocations. Requiring the secret means a browser cannot trigger a sweep,
 * and refusing to run at all when it is unset means a missing env var fails
 * closed rather than leaving the endpoint open.
 */
function isAuthorisedCron(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('release-stale-holds: CRON_SECRET is not set — refusing to run.');
    return false;
  }
  return req.headers.authorization === `Bearer ${secret}`;
}
