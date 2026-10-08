/**
 * Decides what a DJ's accept / reject / played tap should do.
 *
 * Pulled out of the endpoint so it can be tested without Firestore. This is
 * the logic that moves money — a wrong answer here either refunds a song that
 * was already played or leaves a rejected fan out of pocket — so it is kept
 * pure and the endpoint does nothing but carry out the plan.
 */

export type Status = 'pending' | 'accepted' | 'rejected' | 'played';

/** Only these moves are legal. Anything else is refused. */
export const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  pending: ['accepted', 'rejected'],
  accepted: ['played', 'rejected'],
  played: [],
  rejected: [],
};

export interface StatusPlan {
  /** HTTP status to refuse with, when the move is not allowed. */
  error?: { status: number; message: string };
  /** The status to write. Absent when `error` is set. */
  status?: Status;
  /** Who to credit, and how much. Null when nothing should be refunded. */
  refund?: { requesterId: string; amount: number } | null;
  /** True when the request was already in the target state. */
  idempotent?: boolean;
}

export interface RequestDoc {
  djId?: unknown;
  status?: unknown;
  tipAmount?: unknown;
  requester?: { id?: unknown } | null;
}

export function planStatusChange(
  request: RequestDoc,
  callerUid: string,
  target: Status
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

  // A double tap is not an error, but it must not refund a second time.
  if (current === target) {
    return { status: target, refund: null, idempotent: true };
  }

  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    return {
      error: { status: 409, message: `A ${current} request cannot be marked ${target}.` },
    };
  }

  if (target !== 'rejected') {
    return { status: target, refund: null };
  }

  const amount = typeof request.tipAmount === 'number' ? request.tipAmount : 0;
  const requesterId = request.requester?.id;

  // No money, no valid recipient, or an account already anonymised by
  // deletion — all still valid rejections, just nothing to give back.
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof requesterId !== 'string' ||
    !requesterId ||
    requesterId === 'deleted'
  ) {
    return { status: target, refund: null };
  }

  return { status: target, refund: { requesterId, amount } };
}
