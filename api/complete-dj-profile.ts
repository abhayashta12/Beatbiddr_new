import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PHONE_RE = /^\+?[\d\s\-()]{7,15}$/;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body as Record<string, unknown>;
  const username = str(body.username).toLowerCase();
  const stageName = str(body.stageName);
  const legalName = str(body.legalName);
  const phone = str(body.phone);
  const address = str(body.address);
  const club = str(body.club);

  // Identity data is validated here, not in the browser — the form can be bypassed.
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3–20 characters: lowercase letters, numbers, and underscores only.',
    });
  }
  if (!stageName || stageName.length > 50) {
    return res.status(400).json({ error: 'Stage name is required (max 50 characters).' });
  }
  if (!legalName || legalName.length > 100) {
    return res.status(400).json({ error: 'Legal name is required (max 100 characters).' });
  }
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  }
  if (!address || address.length > 200) {
    return res.status(400).json({ error: 'Address is required (max 200 characters).' });
  }
  if (club.length > 100) {
    return res.status(400).json({ error: 'Venue name is too long (max 100 characters).' });
  }

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const usernameRef = db.collection('djUsernames').doc(username);

  try {
    await db.runTransaction(async (tx) => {
      const [userSnap, usernameSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(usernameRef),
      ]);

      if (!userSnap.exists) {
        throw Object.assign(new Error('Account not found.'), { status: 404 });
      }
      const user = userSnap.data()!;

      if (user.role !== 'dj') {
        throw Object.assign(new Error('Only DJ accounts can create a DJ profile.'), { status: 403 });
      }
      if (user.djProfileComplete === true) {
        throw Object.assign(new Error('Your DJ profile is already set up.'), { status: 409 });
      }
      // Claiming is atomic: a second request for the same username inside this
      // transaction window is retried by Firestore and then sees the taken doc.
      if (usernameSnap.exists && usernameSnap.data()!.uid !== uid) {
        throw Object.assign(
          new Error(`Username "${username}" is already taken. Please choose another.`),
          { status: 409 }
        );
      }

      tx.set(usernameRef, { uid, claimedAt: new Date().toISOString() });
      tx.update(userRef, {
        djProfile: {
          username,
          stageName,
          legalName,
          phone,
          address,
          club,
          email: user.email ?? null,
          verified: false,
        },
        djProfileComplete: true,
      });
    });

    return res.status(200).json({ username });
  } catch (err: any) {
    const status = err.status ?? 500;
    if (status === 500) console.error('complete-dj-profile failed:', err.message);
    return res.status(status).json({ error: err.message ?? 'Failed to save profile.' });
  }
}
