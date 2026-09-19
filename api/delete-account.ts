import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCaller, adminAuth, adminDb } from './_lib/firebaseAdmin';

/**
 * Permanently deletes the caller's account.
 *
 * Order is deliberate. Firestore work happens first and the auth user is
 * removed last, so a failure part-way through leaves the person still able to
 * sign in rather than locked out of an account that still holds their data.
 *
 * Past song requests are anonymised rather than deleted: the DJ keeps an
 * accurate record of what was played and paid, while the personal details go.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uid = await verifyCaller(req);
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  // Checked on the server too, not just in the dialog — this endpoint must
  // never be something a stray request can trigger.
  const { confirm } = req.body as { confirm?: string };
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Confirmation text did not match.' });
  }

  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  try {
    const snap = await userRef.get();
    if (!snap.exists) {
      // Already gone from Firestore — still clear the auth user so the account
      // cannot be signed into.
      await adminAuth().deleteUser(uid).catch(() => {});
      return res.status(200).json({ deleted: true });
    }

    const user = snap.data()!;

    // 1 — strip personal details from past requests, in pages of 400 so a
    //     heavy user cannot exceed Firestore's 500-write batch limit.
    let anonymised = 0;
    while (true) {
      const batchSnap = await db
        .collection('songRequests')
        .where('requester.id', '==', uid)
        .limit(400)
        .get();
      if (batchSnap.empty) break;

      const batch = db.batch();
      batchSnap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          'requester.id': 'deleted',
          'requester.name': 'Deleted user',
          'requester.avatar': '',
          message: '',
        });
      });
      await batch.commit();
      anonymised += batchSnap.size;
      if (batchSnap.size < 400) break;
    }

    // 2 — release the DJ username so the name is available again
    const username = user.djProfile?.username;
    if (typeof username === 'string' && username) {
      const nameRef = db.collection('djUsernames').doc(username);
      const nameSnap = await nameRef.get();
      // Only release a reservation this account actually owns
      if (nameSnap.exists && nameSnap.data()?.uid === uid) {
        await nameRef.delete();
      }
    }

    // 3 — remove the profile and its ledger subcollection
    await db.recursiveDelete(userRef);

    // 4 — finally the auth user
    await adminAuth().deleteUser(uid);

    console.log(`Account ${uid} deleted (${anonymised} requests anonymised).`);
    return res.status(200).json({ deleted: true });
  } catch (err: any) {
    console.error('delete-account failed:', err.message);
    return res.status(500).json({ error: 'Could not delete your account. Please try again.' });
  }
}
