import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

/** Below this, Stripe's own fees make a transfer pointless. */
const MIN_PAYOUT = 10;

/**
 * Pays a DJ their available earnings.
 *
 * The balance is debited inside a Firestore transaction *before* the Stripe
 * transfer is attempted, and credited back if the transfer fails. Doing it the
 * other way round would let two taps in quick succession both read the same
 * balance and transfer it twice.
 *
 * The Stripe call carries an idempotency key derived from the payout document,
 * so a retried request can never move money a second time.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const limited = await checkRateLimit(uid, {
    action: 'payout',
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limited.allowed) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res.status(429).json({ error: 'Too many payout attempts. Try again later.' });
  }

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const payoutRef = userRef.collection('payouts').doc();

  let reserved = 0;
  let accountId = '';

  try {
    // ---- 1. reserve the funds ----
    const reservation = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw Object.assign(new Error('Account not found.'), { status: 404 });

      const user = snap.data()!;
      if (user.role !== 'dj') {
        throw Object.assign(new Error('Only DJ accounts receive payouts.'), { status: 403 });
      }
      if (user.djProfileComplete !== true) {
        throw Object.assign(new Error('Finish setting up your DJ profile first.'), { status: 409 });
      }
      if (typeof user.stripeAccountId !== 'string' || !user.stripeAccountId) {
        throw Object.assign(new Error('Set up payouts first.'), { status: 409 });
      }
      // The account id must be one WE created for THIS uid. Checked against
      // Stripe below as well, but refuse an obviously forged shape early.
      if (!user.stripeAccountId.startsWith('acct_')) {
        throw Object.assign(new Error('Payout account is not valid.'), { status: 409 });
      }
      if (user.payoutsEnabled !== true) {
        throw Object.assign(
          new Error('Stripe has not finished verifying your details yet.'),
          { status: 409 }
        );
      }

      const available =
        typeof user.djEarningsAvailable === 'number' ? user.djEarningsAvailable : 0;
      const amount = Math.floor(available * 100) / 100;

      if (amount < MIN_PAYOUT) {
        throw Object.assign(
          new Error(`You need at least $${MIN_PAYOUT} to cash out. You have $${amount.toFixed(2)}.`),
          { status: 400 }
        );
      }

      // Debit first. If the transfer then fails we put it back — the reverse
      // order would let concurrent taps both see the same balance.
      tx.update(userRef, { djEarningsAvailable: FieldValue.increment(-amount) });
      tx.set(payoutRef, {
        amount,
        status: 'pending',
        stripeAccountId: user.stripeAccountId,
        requestedAt: new Date().toISOString(),
      });

      return { amount, accountId: user.stripeAccountId as string };
    });

    reserved = reservation.amount;
    accountId = reservation.accountId;

    // ---- 2. verify the destination with Stripe, not with our own document ----
    //
    // Defence in depth. Firestore rules keep the browser out of these fields,
    // but this endpoint moves real money and must not be the only thing
    // standing between a forged document and a transfer. Stripe is the
    // authority on whether an account exists, belongs to this uid, and is
    // cleared to receive funds.
    const account = await stripe.accounts.retrieve(accountId);

    if (account.metadata?.uid !== uid || account.metadata?.app !== 'beatbiddr') {
      // The account exists but we did not create it for this user.
      console.error(
        `PAYOUT BLOCKED: ${uid} tried to pay out to ${accountId}, owned by ${account.metadata?.uid ?? 'unknown'}`
      );
      throw Object.assign(new Error('Payout account is not valid.'), { status: 403 });
    }
    if (account.payouts_enabled !== true || account.charges_enabled !== true) {
      throw Object.assign(
        new Error('Stripe has not finished verifying your details yet.'),
        { status: 409 }
      );
    }

    // ---- 3. move the money ----
    const transfer = await stripe.transfers.create(
      {
        amount: Math.round(reserved * 100),
        currency: 'usd',
        destination: accountId,
        description: 'BeatBiddr earnings',
        metadata: { uid, payoutId: payoutRef.id },
      },
      // Keyed to this payout document: a retry reuses the same transfer
      // rather than creating a second one.
      { idempotencyKey: `payout_${payoutRef.id}` }
    );

    await payoutRef.update({
      status: 'paid',
      stripeTransferId: transfer.id,
      paidAt: new Date().toISOString(),
    });

    return res.status(200).json({ amount: reserved, transferId: transfer.id });
  } catch (err: any) {
    const status = err.status ?? 500;

    // The funds were reserved but the transfer did not go through. Give them
    // back, or the DJ silently loses the balance.
    if (reserved > 0) {
      try {
        await db.runTransaction(async (tx) => {
          tx.update(userRef, { djEarningsAvailable: FieldValue.increment(reserved) });
          tx.set(
            payoutRef,
            { status: 'failed', failedAt: new Date().toISOString(), error: String(err.message) },
            { merge: true }
          );
        });
      } catch (reversalErr: any) {
        // Loud, because now a balance really is missing and needs a human.
        console.error(
          `PAYOUT REVERSAL FAILED for ${uid}, payout ${payoutRef.id}, $${reserved}:`,
          reversalErr.message
        );
      }
    }

    if (status === 500) {
      console.error('request-payout failed:', err.message);
      return res.status(500).json({ error: 'Could not send your payout. Please try again.' });
    }
    return res.status(status).json({ error: err.message });
  }
}
