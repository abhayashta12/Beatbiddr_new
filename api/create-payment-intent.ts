import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-04-10',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount } = req.body as { amount?: number };

  if (!amount || typeof amount !== 'number' || amount < 100 || amount > 100000) {
    return res.status(400).json({ error: 'Invalid amount. Must be between $1 and $1000.' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to create payment intent.' });
  }
}
