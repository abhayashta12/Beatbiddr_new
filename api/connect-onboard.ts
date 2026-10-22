import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';
import { checkRateLimit } from './_lib/rateLimit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

/**
 * Starts (or resumes) a DJ's Stripe Connect onboarding.
 *
 * Express accounts: Stripe hosts the whole flow and collects the identity,
 * bank and tax details needed to pay someone. None of it reaches us, which is
 * the point — we are not equipped to hold bank details, and a DJ's payout
 * information is exactly the data we least want on our side.
 *
 * Returns a single-use URL. Account links expire quickly, so this is called
 * fresh each time the DJ taps the button rather than stored.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const limited = await checkRateLimit(uid, {
    action: 'connect-onboard',
    limit: 10,
    windowSeconds: 300,
  });
  if (!limited.allowed) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
  }

  const origin = appOrigin(req);
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'Account not found.' });

    const user = snap.data()!;
    if (user.role !== 'dj') {
      return res.status(403).json({ error: 'Only DJ accounts receive payouts.' });
    }
    if (user.djProfileComplete !== true) {
      return res.status(409).json({ error: 'Finish setting up your DJ profile first.' });
    }

    let accountId: string | undefined =
      typeof user.stripeAccountId === 'string' ? user.stripeAccountId : undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: typeof user.email === 'string' ? user.email : undefined,
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        business_profile: {
          product_description: 'Song requests and tips received through BeatBiddr',
        },
        // Lets us find the BeatBiddr account from the Stripe dashboard side.
        metadata: { uid, app: 'beatbiddr' },
      });
      accountId = account.id;
      // Stored before the link is handed out, so a DJ who abandons onboarding
      // resumes the same account instead of creating a second one.
      await userRef.update({ stripeAccountId: accountId, payoutsEnabled: false });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      // Returning to /settings either way: the webhook decides what the DJ
      // actually sees, since onboarding can complete without being "done".
      refresh_url: `${origin}/settings`,
      return_url: `${origin}/settings`,
      type: 'account_onboarding',
    });

    return res.status(200).json({ url: link.url });
  } catch (err: any) {
    console.error('connect-onboard failed:', err.message);
    return res.status(500).json({ error: 'Could not start payout setup. Please try again.' });
  }
}

/**
 * Where to send the DJ back to.
 *
 * Taken from configuration, never from a request header — an attacker-supplied
 * Host would otherwise decide where our return link points.
 */
function appOrigin(_req: VercelRequest): string {
  const configured = process.env.APP_ORIGIN;
  if (configured) return configured.replace(/\/$/, '');
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercelUrl ? `https://${vercelUrl}` : 'https://beatbiddr.com';
}
