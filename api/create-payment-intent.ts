import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { verifyCaller } from './_lib/firebaseAdmin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only signed-in BeatBiddr users may create payment intents.
  const uid = await verifyCaller(req);
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { amount } = req.body as { amount?: number };

  if (!amount || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 100 || amount > 100000) {
    return res.status(400).json({ error: 'Invalid amount. Must be between $1 and $1000.' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      // The webhook credits this uid's wallet — the client never touches the balance.
      metadata: { uid, purpose: 'wallet_deposit' },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create payment intent.' });
  }
}
