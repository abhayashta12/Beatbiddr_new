/**
 * Fixed-window rate-limit arithmetic.
 *
 * Deliberately in its own file with no imports. It used to live alongside the
 * Firestore-backed limiter, which meant testing this arithmetic loaded the
 * whole Firebase Admin SDK — and broke outright once one of its transitive
 * dependencies went ESM-only. Pure logic should not need a database to be
 * tested.
 */

export type RateLimitDecision =
  | { kind: 'start-window' }
  | { kind: 'increment' }
  | { kind: 'refuse'; retryAfter: number };

/**
 * Decides what to do with one call.
 *
 * `windowStartMs` is null when no counter exists yet. A fixed window costs one
 * read and one write per call rather than storing every hit; the trade-off is
 * that a caller can spend a full window's budget at the end of one window and
 * again at the start of the next. For protecting a third-party quota and
 * blunting scripted abuse that is fine — this is not a billing control.
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
