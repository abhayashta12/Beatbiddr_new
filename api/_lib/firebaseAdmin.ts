import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { VercelRequest } from '@vercel/node';

// FIREBASE_SERVICE_ACCOUNT_KEY is the full service-account JSON
// (Firebase Console > Project Settings > Service accounts > Generate new private key),
// stored as a single-line Vercel env var.
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY env var is not set.');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());

/**
 * Verifies the Firebase ID token from the Authorization: Bearer header.
 * Returns the caller's uid, or null if missing/invalid.
 */
export async function verifyCaller(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(header.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}
