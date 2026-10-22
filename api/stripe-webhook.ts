import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { adminDb } from './_lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Stripe signature verification requires the raw, unparsed request body.
export const config = { api: { bodyParser: false } };

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return res.status(400).json({ error: 'Missing signature or webhook secret.' });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature as string, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const uid = intent.metadata?.uid;

    if (intent.metadata?.purpose !== 'wallet_deposit' || !uid) {
      // Not a wallet deposit we created — acknowledge and ignore.
      return res.status(200).json({ received: true });
    }

    // Everything we create is USD. Dividing by 100 is only correct for
    // two-decimal currencies, so refuse anything else rather than credit a
    // wrong figure (JPY, for instance, has no minor unit).
    if (intent.currency !== 'usd') {
      console.error(`Unexpected currency ${intent.currency} on ${intent.id} — not credited.`);
      return res.status(200).json({ received: true });
    }

    // amount_received, not amount: a partial capture must credit only what was
    // actually taken.
    const amountDollars = intent.amount_received / 100;
    if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
      console.error(`Non-positive amount on ${intent.id} — not credited.`);
      return res.status(200).json({ received: true });
    }
    const db = adminDb();
    const userRef = db.collection('users').doc(uid);
    // Ledger doc id = PaymentIntent id → retried webhook deliveries are idempotent.
    const ledgerRef = userRef.collection('ledger').doc(intent.id);

    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(ledgerRef);
        if (existing.exists) return; // already credited

        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw new Error(`User ${uid} not found for deposit ${intent.id}`);

        tx.update(userRef, { walletBalance: FieldValue.increment(amountDollars) });
        tx.set(ledgerRef, {
          type: 'deposit',
          amount: amountDollars,
          currency: intent.currency,
          paymentIntentId: intent.id,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err: any) {
      console.error('Failed to credit deposit:', err.message);
      // Non-200 makes Stripe retry the delivery.
      return res.status(500).json({ error: 'Failed to credit wallet.' });
    }
  }

  /**
   * Money leaving us again: a chargeback, or a refund issued in the Stripe
   * dashboard.
   *
   * Neither was handled before, which made the wallet a money duplicator: a
   * fan could top up $500, spend it, dispute the card charge, and keep the
   * balance while Stripe clawed the cash back from us. Repeatable.
   *
   * The wallet is allowed to go negative here. Refusing to debit because the
   * balance is too low would leave us out of pocket and reward exactly the
   * behaviour we are guarding against.
   */
  if (event.type === 'charge.dispute.created' || event.type === 'charge.refunded') {
    try {
      await handleMoneyReturned(event);
    } catch (err: any) {
      console.error(`Failed to handle ${event.type}:`, err.message);
      // Non-200 makes Stripe retry.
      return res.status(500).json({ error: 'Failed to process.' });
    }
  }

  // Not money, but worth a trace rather than vanishing silently.
  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    console.warn(
      `Payment failed for uid=${intent.metadata?.uid ?? 'unknown'} intent=${intent.id}: ` +
        `${intent.last_payment_error?.message ?? 'no reason given'}`
    );
  }

  // A DJ finished (or changed) Stripe Connect onboarding. payouts_enabled is
  // Stripe's own verdict on whether they can receive money — we never infer
  // it from the DJ returning to the app, because onboarding can be abandoned
  // halfway and still bounce back to our return_url.
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    const uid = account.metadata?.uid;

    if (!uid || account.metadata?.app !== 'beatbiddr') {
      return res.status(200).json({ received: true });
    }

    try {
      await adminDb()
        .collection('users')
        .doc(uid)
        .update({
          payoutsEnabled: account.payouts_enabled === true && account.charges_enabled === true,
          payoutsDetailsSubmitted: account.details_submitted === true,
        });
    } catch (err: any) {
      console.error(`Failed to sync Connect status for ${uid}:`, err.message);
      return res.status(500).json({ error: 'Failed to sync account status.' });
    }
  }

  return res.status(200).json({ received: true });
}

/**
 * Debits a wallet when Stripe takes money back from us.
 *
 * Handles both a dispute (the full charge is pulled) and a refund (which may
 * be partial, and may happen more than once on the same charge).
 *
 * Idempotency and partial refunds are handled the same way: a single ledger
 * document per charge records how much we have already debited, so each
 * delivery debits only the difference. A retried webhook computes a delta of
 * zero and does nothing.
 */
async function handleMoneyReturned(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const isDispute = event.type === 'charge.dispute.created';

  // The uid lives on the PaymentIntent we created, not on the charge.
  const intentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!intentId) {
    console.warn(`${event.type} on charge ${charge.id} has no payment intent — ignored.`);
    return;
  }

  const intent = await stripe.paymentIntents.retrieve(intentId);
  const uid = intent.metadata?.uid;
  if (intent.metadata?.purpose !== 'wallet_deposit' || !uid) {
    // Not a top-up we made. Nothing of ours to reverse.
    return;
  }
  if (charge.currency !== 'usd') {
    console.error(`Unexpected currency ${charge.currency} on ${charge.id} — not debited.`);
    return;
  }

  // A dispute pulls the whole charge; a refund may be partial and cumulative.
  const takenCents = isDispute ? charge.amount : charge.amount_refunded;
  if (!Number.isFinite(takenCents) || takenCents <= 0) return;

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const reversalRef = userRef.collection('ledger').doc(`reversal_${charge.id}`);

  await db.runTransaction(async (tx) => {
    const [existing, userSnap] = await Promise.all([tx.get(reversalRef), tx.get(userRef)]);
    if (!userSnap.exists) {
      // Account deleted. Nothing to debit; the loss is already realised.
      console.error(
        `${event.type}: user ${uid} no longer exists, $${takenCents / 100} unrecovered.`
      );
      return;
    }

    const alreadyCents = typeof existing.data()?.debitedCents === 'number'
      ? existing.data()!.debitedCents
      : 0;
    const deltaCents = takenCents - alreadyCents;
    // A retry, or a refund we have already accounted for in full.
    if (deltaCents <= 0) return;

    const deltaDollars = deltaCents / 100;

    tx.update(userRef, {
      // Deliberately allowed to go negative: the money is gone from our side
      // regardless, and clamping at zero would let someone dispute a spent
      // top-up for free.
      walletBalance: FieldValue.increment(-deltaDollars),
      ...(isDispute
        ? { disputeCount: FieldValue.increment(1), flaggedForReview: true }
        : {}),
    });

    tx.set(reversalRef, {
      type: isDispute ? 'dispute' : 'refund_to_card',
      amount: deltaDollars,
      debitedCents: takenCents,
      chargeId: charge.id,
      paymentIntentId: intentId,
      currency: charge.currency,
      timestamp: new Date().toISOString(),
    });
  });

  console.log(`${event.type}: debited $${takenCents / 100} from ${uid} (charge ${charge.id}).`);
}
