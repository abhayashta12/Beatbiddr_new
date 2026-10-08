import { adminDb } from './firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * Per-user rate limiting.
 *
 * In-memory counters are useless here: Vercel runs many instances and
 * recycles them freely, so a caller simply lands on a fresh one. The counter
 * has to live somewhere shared, and we already have Firestore.
 *
 * A fixed window is used rather than a sliding log — it costs one document
 * read and one write per call instead of storing every hit. The trade-off is
 * that a caller can spend a full window's budget at the end of one window and
 * again at the start of the next. For protecting a third-party quota and
 * blunting scripted abuse that is fine; this is not a billing control.
 *
 * Rules deny all client access to rateLimits, so only the Admin SDK touches it.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets. Suitable for Retry-After. */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Distinct bucket per endpoint, e.g. 'search'. */
  action: string;
  /** Calls permitted inside one window. */
  limit: number;
  windowSeconds: number;
}

export type RateLimitDecision =
  | { kind: 'start-window' }
  | { kind: 'increment' }
  | { kind: 'refuse'; retryAfter: number };

/**
 * The window arithmetic, separated from Firestore so it can be tested.
 *
 * `windowStartMs` is null when no counter exists yet.
 */
export function decideRateLimit(
  windowStartMs: number | null,
  count: number,
  nowMs: number,
  limit: number,
  windowSeconds: number
): RateLimitDecision {
  if (windowStartMs === null) return { kind: 'start-window' };

  const elapsed = nowMs - windowStartMs;
  if (elapsed >= windowSeconds * 1000) return { kind: 'start-window' };

  if (count >= limit) {
    // Never report 0 — a Retry-After of 0 invites an immediate retry.
    const retryAfter = Math.max(1, Math.ceil((windowSeconds * 1000 - elapsed) / 1000));
    return { kind: 'refuse', retryAfter };
  }

  return { kind: 'increment' };
}

export async function checkRateLimit(
  uid: string,
  { action, limit, windowSeconds }: RateLimitOptions
): Promise<RateLimitResult> {
  const db = adminDb();
  const ref = db.collection('rateLimits').doc(`${action}:${uid}`);
  const now = Date.now();

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const windowStart = snap.exists
        ? (data?.windowStart as Timestamp | undefined)?.toMillis() ?? 0
        : null;
      const count = typeof data?.count === 'number' ? data.count : 0;

      const decision = decideRateLimit(windowStart, count, now, limit, windowSeconds);

      if (decision.kind === 'refuse') {
        return { allowed: false, retryAfter: decision.retryAfter };
      }
      if (decision.kind === 'start-window') {
        tx.set(ref, {
          count: 1,
          windowStart: Timestamp.fromMillis(now),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { allowed: true, retryAfter: 0 };
      }

      tx.update(ref, { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      return { allowed: true, retryAfter: 0 };
    });
  } catch (err: any) {
    // Fail open. A Firestore blip must not stop people requesting songs or
    // topping up — the endpoints behind this still verify identity, money and
    // balances on their own.
    console.error(`checkRateLimit(${action}) failed, allowing request:`, err.message);
    return { allowed: true, retryAfter: 0 };
  }
}
