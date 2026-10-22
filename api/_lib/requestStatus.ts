/**
 * Decides what a DJ's accept / reject / played tap should do.
 *
 * The money rules:
 *   - A request HOLDS the tip. It leaves the fan's spendable balance so it
 *     cannot be spent twice, but it has not been paid to anyone.
 *   - ACCEPT captures the hold. The fan has now paid, and the DJ has earned.
 *   - REJECT releases the hold back to spendable. The fan never paid.
 *   - PLAYED moves no money. Whether a DJ plays an accepted song is between
 *     them and the room.
 *
 * Pulled out of the endpoint so it can be tested without Firestore. This is
 * the logic that moves money, so it is kept pure and the endpoint does nothing
 * but carry out the plan.
 */

export type Status = 'pending' | 'accepted' | 'rejected' | 'played';

/** Only these moves are legal. Anything else is refused. */
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  pending: ['accepted', 'rejected'],
  accepted: ['played'],
  played: [],
  rejected: [],
};

export interface MoneyMove {
  requesterId: string;
  amount: number;
}

export interface StatusPlan {
  /** HTTP status to refuse with, when the move is not allowed. */
  error?: { status: number; message: string };
  /** The status to write. Absent when `error` is set. */
  status?: Status;
  /** Accept: the hold becomes a real payment. */
  capture?: MoneyMove | null;
  /** Reject: the hold goes back to the fan's spendable balance. */
  release?: MoneyMove | null;
  /** Accept: what the DJ has earned, after the platform's cut. */
  earning?: { djId: string; gross: number; fee: number; net: number } | null;
  /** True when the request was already in the target state. */
  idempotent?: boolean;
}

/**
 * Splits a tip into the platform's cut and the DJ's share.
 *
 * Both halves are rounded to whole cents and the fee absorbs the rounding, so
 * fee + net always equals gross exactly — otherwise cents would quietly
 * appear or vanish on every payout.
 */
export function splitTip(gross: number, feePercent: number): { fee: number; net: number } {
  if (!Number.isFinite(gross) || gross <= 0) return { fee: 0, net: 0 };

  const pct = Number.isFinite(feePercent) ? Math.min(100, Math.max(0, feePercent)) : 0;
  const grossCents = Math.round(gross * 100);
  const netCents = Math.round((grossCents * (100 - pct)) / 100);
  // Derive the fee by subtraction so the two halves can never fail to sum.
  const feeCents = grossCents - netCents;

  return { fee: feeCents / 100, net: netCents / 100 };
}

export interface RequestDoc {
  djId?: unknown;
  status?: unknown;
  tipAmount?: unknown;
  requester?: { id?: unknown } | null;
}

const NOTHING = { capture: null, release: null, earning: null } as const;

export function planStatusChange(
  request: RequestDoc,
  callerUid: string,
  target: Status,
  feePercent = 0
): StatusPlan {
  // The only authorisation that matters: this request was sent to you. A
  // missing djId must be refused rather than treated as a match.
  if (typeof request.djId !== 'string' || request.djId !== callerUid) {
    return { error: { status: 403, message: 'That request was not sent to you.' } };
  }

  const current: Status =
    request.status === 'accepted' ||
    request.status === 'rejected' ||
    request.status === 'played'
      ? request.status
      : 'pending';

  // A double tap is not an error, but it must move no money a second time.
  if (current === target) {
    return { status: target, ...NOTHING, idempotent: true };
  }

  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    return {
      error: { status: 409, message: `A ${current} request cannot be marked ${target}.` },
    };
  }

  const tip = typeof request.tipAmount === 'number' ? request.tipAmount : 0;
  const requesterId = request.requester?.id;

  // A hold can only be settled when there is money and someone to settle it
  // with. 'deleted' is an account anonymised by deletion.
  const settleable =
    Number.isFinite(tip) &&
    tip > 0 &&
    typeof requesterId === 'string' &&
    Boolean(requesterId) &&
    requesterId !== 'deleted';

  if (target === 'rejected') {
    return {
      status: target,
      capture: null,
      release: settleable ? { requesterId: requesterId as string, amount: tip } : null,
      earning: null,
    };
  }

  if (target === 'accepted') {
    if (!settleable) {
      return { status: target, ...NOTHING };
    }
    const { fee, net } = splitTip(tip, feePercent);
    return {
      status: target,
      capture: { requesterId: requesterId as string, amount: tip },
      release: null,
      earning: { djId: callerUid, gross: tip, fee, net },
    };
  }

  // Played: a status change only. We take no position on whether an accepted
  // song actually gets played.
  return { status: target, ...NOTHING };
}
