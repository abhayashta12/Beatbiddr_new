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

    const amountDollars = intent.amount_received / 100;
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

  return res.status(200).json({ received: true });
}
