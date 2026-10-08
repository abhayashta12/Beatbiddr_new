import { describe, it, expect } from 'vitest';
import { planStatusChange, type RequestDoc } from './requestStatus';

/**
 * This is the logic that moves money. Getting it wrong either refunds a song
 * that was already played, or leaves a rejected fan out of pocket.
 */

const base: RequestDoc = {
  djId: 'dj1',
  status: 'pending',
  tipAmount: 25,
  requester: { id: 'fan1' },
};

describe('ownership', () => {
  it('refuses a DJ the request was not sent to', () => {
    expect(planStatusChange(base, 'dj2', 'accepted').error?.status).toBe(403);
  });

  it('allows the DJ it was sent to', () => {
    expect(planStatusChange(base, 'dj1', 'accepted').error).toBeUndefined();
  });

  it('refuses a missing djId rather than treating it as a match', () => {
    expect(planStatusChange({ ...base, djId: undefined }, 'dj1', 'accepted').error?.status).toBe(403);
  });

  it('does not match a non-string djId against a uid', () => {
    expect(planStatusChange({ ...base, djId: null }, 'dj1', 'accepted').error?.status).toBe(403);
  });
});

describe('legal transitions', () => {
  it('pending to accepted refunds nothing', () => {
    const plan = planStatusChange(base, 'dj1', 'accepted');
    expect(plan.status).toBe('accepted');
    expect(plan.refund).toBeNull();
  });

  it('pending to rejected refunds the tip', () => {
    expect(planStatusChange(base, 'dj1', 'rejected').refund).toEqual({
      requesterId: 'fan1',
      amount: 25,
    });
  });

  it('accepted to played refunds nothing', () => {
    const plan = planStatusChange({ ...base, status: 'accepted' }, 'dj1', 'played');
    expect(plan.status).toBe('played');
    expect(plan.refund).toBeNull();
  });

  it('accepted to rejected still refunds — a DJ can change their mind', () => {
    expect(planStatusChange({ ...base, status: 'accepted' }, 'dj1', 'rejected').refund).toEqual({
      requesterId: 'fan1',
      amount: 25,
    });
  });

  it('treats an unrecognised stored status as pending', () => {
    expect(planStatusChange({ ...base, status: 'weird' }, 'dj1', 'accepted').status).toBe('accepted');
  });
});

describe('illegal transitions', () => {
  it('will not reject a song that was already played', () => {
    // The money case that matters: the set is over, the fan heard their song.
    expect(planStatusChange({ ...base, status: 'played' }, 'dj1', 'rejected').error?.status).toBe(409);
  });

  it('will not revive a rejected request', () => {
    expect(planStatusChange({ ...base, status: 'rejected' }, 'dj1', 'accepted').error?.status).toBe(409);
    expect(planStatusChange({ ...base, status: 'rejected' }, 'dj1', 'played').error?.status).toBe(409);
  });

  it('will not re-play a played request', () => {
    expect(planStatusChange({ ...base, status: 'played' }, 'dj1', 'accepted').error?.status).toBe(409);
  });
});

describe('double-refund protection', () => {
  it('rejecting an already-rejected request refunds nothing', () => {
    const plan = planStatusChange({ ...base, status: 'rejected' }, 'dj1', 'rejected');
    expect(plan.idempotent).toBe(true);
    expect(plan.refund).toBeNull();
    expect(plan.error).toBeUndefined();
  });

  it('is idempotent for non-refund statuses too', () => {
    expect(planStatusChange({ ...base, status: 'played' }, 'dj1', 'played').idempotent).toBe(true);
  });
});

describe('refund eligibility', () => {
  it.each([
    ['a zero tip', 0],
    ['a negative tip', -5],
    ['a non-numeric tip', 'lots' as unknown as number],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses to refund %s', (_label, tipAmount) => {
    expect(planStatusChange({ ...base, tipAmount }, 'dj1', 'rejected').refund).toBeNull();
  });

  it('does not refund an account anonymised by deletion', () => {
    expect(
      planStatusChange({ ...base, requester: { id: 'deleted' } }, 'dj1', 'rejected').refund
    ).toBeNull();
  });

  it('does not refund when the requester id is missing', () => {
    expect(planStatusChange({ ...base, requester: {} }, 'dj1', 'rejected').refund).toBeNull();
    expect(planStatusChange({ ...base, requester: null }, 'dj1', 'rejected').refund).toBeNull();
  });

  it('still records the rejection when there is nothing to refund', () => {
    const plan = planStatusChange({ ...base, tipAmount: 0 }, 'dj1', 'rejected');
    expect(plan.status).toBe('rejected');
    expect(plan.error).toBeUndefined();
  });
});
