import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminDb } from './_lib/firebaseAdmin';

const PHONE_RE = /^\+?[\d\s\-()]{7,15}$/;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined);

/**
 * Edits an existing DJ profile. The username is deliberately absent — it is
 * claimed once at signup and never changes, so the reservation in djUsernames
 * can never drift from the profile.
 *
 * Fields are written with dot notation so untouched parts of djProfile
 * (username, email, verified) survive the update.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body as Record<string, unknown>;
  const stageName = str(body.stageName);
  const legalName = str(body.legalName);
  const phone = str(body.phone);
  const address = str(body.address);
  const club = str(body.club);
  const isLive = typeof body.isLive === 'boolean' ? body.isLive : undefined;

  const updates: Record<string, unknown> = {};

  // Each field is optional, but anything supplied must be valid — the same
  // checks signup applies, so an edit cannot weaken what signup enforced.
  if (stageName !== undefined) {
    if (!stageName || stageName.length > 50) {
      return res.status(400).json({ error: 'Stage name is required (max 50 characters).' });
    }
    updates['djProfile.stageName'] = stageName;
  }
  if (legalName !== undefined) {
    if (!legalName || legalName.length > 100) {
      return res.status(400).json({ error: 'Legal name is required (max 100 characters).' });
    }
    updates['djProfile.legalName'] = legalName;
  }
  if (phone !== undefined) {
    if (!PHONE_RE.test(phone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }
    updates['djProfile.phone'] = phone;
  }
  if (address !== undefined) {
    if (!address || address.length > 200) {
      return res.status(400).json({ error: 'Address is required (max 200 characters).' });
    }
    updates['djProfile.address'] = address;
  }
  if (club !== undefined) {
    if (club.length > 100) {
      return res.status(400).json({ error: 'Venue name is too long (max 100 characters).' });
    }
    updates['djProfile.club'] = club;
  }
  if (isLive !== undefined) {
    updates['djProfile.isLive'] = isLive;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  try {
    const userRef = adminDb().collection('users').doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) return res.status(404).json({ error: 'Account not found.' });
    const user = snap.data()!;
    if (user.role !== 'dj') {
      return res.status(403).json({ error: 'Only DJ accounts have a DJ profile.' });
    }
    if (user.djProfileComplete !== true) {
      return res.status(409).json({ error: 'Finish setting up your DJ profile first.' });
    }

    await userRef.update(updates);
    return res.status(200).json({ updated: Object.keys(updates).length });
  } catch (err: any) {
    console.error('update-dj-profile failed:', err.message);
    return res.status(500).json({ error: 'Could not save your changes. Please try again.' });
  }
}
