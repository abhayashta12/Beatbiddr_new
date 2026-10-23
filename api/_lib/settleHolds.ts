import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Releasing holds that nobody is going to settle.
 *
 * A pending request has the fan's money held. Something has to close that
 * loop, and three situations leave it open:
 *
 *   - The DJ never answers. End of the night arrives and the hold just sits
 *     there. Released by the scheduled sweep.
 *   - The DJ deletes their account. Nobody is authorised to accept or reject
 *     their requests ever again, so every fan with a pending request loses
 *     that money permanently. This is real money owed to real people.
 *   - The fan deletes their account. The request used to be anonymised and
 *     left pending, so when the DJ later accepted it the settlement was
 *     skipped and the DJ earned nothing — the money evaporated.
 *
 * All three are handled by resolving the request to 'rejected' and putting
 * the hold back, which is the outcome the fan is owed: they were never
 * charged, because nobody ever accepted.
 */

export interface ReleaseResult {
  released: number;
  refundedTotal: number;
}

/**
 * Rejects pending requests matching a field, and returns each hold.
 *
 * @param field  'djId' to release everything owed by one DJ, or
 *               'requester.id' to close out one fan's outstanding requests.
 * @param creditFans  Whether to put the money back in fans' spendable
 *               balances. False when the fan being credited is the same
 *               account that is about to be deleted — crediting a document we
 *               are about to remove is pointless, and the Terms say an
 *               unspent balance is forfeited on deletion.
 */
export async function releasePendingHolds(
  field: 'djId' | 'requester.id',
  value: string,
  creditFans: boolean,
  /**
   * When given, only requests older than this ISO timestamp are released.
   * Used by the on-demand sweep so a fan can reclaim money from a night a DJ
   * never answered, without also cancelling a request they sent a minute ago.
   */
  olderThanIso?: string
): Promise<ReleaseResult> {
  const db = adminDb();
  let released = 0;
  let refundedTotal = 0;

  // Paged, so an account with a long history cannot blow the batch limit or
  // time the function out.
  for (;;) {
    const page = await db
      .collection('songRequests')
      .where(field, '==', value)
      .where('status', '==', 'pending')
      .limit(100)
      .get();

    if (page.empty) break;

    for (const docSnap of page.docs) {
      const request = docSnap.data();

      // Age is filtered here rather than in the query: one person's pending
      // requests are few, and adding timestamp to the query would need
      // another composite index for no real gain.
      if (olderThanIso) {
        const ts = typeof request.timestamp === 'string' ? request.timestamp : '';
        if (!ts || ts >= olderThanIso) continue;
      }

      const tip = typeof request.tipAmount === 'number' ? request.tipAmount : 0;
      const requesterId = request.requester?.id;

      const shouldCredit =
        creditFans &&
        tip > 0 &&
        typeof requesterId === 'string' &&
        Boolean(requesterId) &&
        requesterId !== 'deleted';

      try {
        await db.runTransaction(async (tx) => {
          // Re-read inside the transaction: a DJ may have answered this
          // request between the query above and now.
          const fresh = await tx.get(docSnap.ref);
          if (!fresh.exists || fresh.data()?.status !== 'pending') return;

          const fanRef = shouldCredit
            ? db.collection('users').doc(requesterId as string)
            : null;
          const fanSnap = fanRef ? await tx.get(fanRef) : null;

          // ---- writes ----
          tx.update(docSnap.ref, { status: 'rejected' });
          tx.set(
            db.collection('queueEntries').doc(docSnap.id),
            { status: 'rejected' },
            { merge: true }
          );

          if (fanRef && fanSnap?.exists) {
            // Never release more than is actually held, so a request that
            // predates holds cannot mint money.
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
        // One stuck request must not abandon the rest — the remainder is
        // other people's money.
        console.error(`releasePendingHolds: ${docSnap.id} failed:`, err.message);
      }
    }

    if (page.size < 100) break;
  }

  return { released, refundedTotal };
}
