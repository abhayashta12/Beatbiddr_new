import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, verifyCaller } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';
import { releasePendingHolds } from './_lib/settleHolds';
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

/**
 * How long a request may sit unanswered before the hold goes back.
 *
 * Six hours outlasts any single set while still being comfortably shorter
 * than the gap between sweeps. The sweep runs once a day (Vercel's Hobby plan
 * permits only daily crons), at 14:00 UTC — roughly 9am Eastern, 6am Pacific.
 * Every North American club has closed by then, so one pass catches the whole
 * previous night.
 *
 * The trade-off of a daily sweep: a request sent just after a sweep and never
 * answered waits until the next one. The fan is not charged in the meantime —
 * the money is held, not taken — but it is not spendable either. An hourly
 * sweep would narrow that window and needs a paid Vercel plan.
 */
const STALE_AFTER_HOURS = 6;
const PAGE_SIZE = 100;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 3600_000).toISOString();

  // Two callers, two scopes.
  //
  // The scheduled sweep runs as the platform and releases everybody's stale
  // holds. A signed-in user may also release their OWN — which matters
  // because the sweep only runs daily on this plan, and nobody should have to
  // wait until tomorrow to get back money a DJ never took.
  if (!isAuthorisedCron(req)) {
    const uid = await verifyCaller(req);
    if (!uid) {
      // Deliberately 404, not 403: an unauthenticated caller learns nothing
      // about whether this endpoint exists.
      return res.status(404).json({ error: 'Not found' });
    }

    const limited = await checkRateLimit(uid, {
      action: 'release-own-holds',
      limit: 10,
      windowSeconds: 600,
    });
    if (!limited.allowed) {
      res.setHeader('Retry-After', String(limited.retryAfter));
      return res.status(429).json({ error: 'Try again in a few minutes.' });
    }

    try {
      const { released, refundedTotal } = await releasePendingHolds(
        'requester.id',
        uid,
        true,
        cutoff
      );
      return res.status(200).json({ released, refundedTotal, scope: 'self' });
    } catch (err: any) {
      console.error('release-stale-holds (self) failed:', err.message);
      return res.status(500).json({ error: 'Could not release your held funds.' });
    }
  }

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
