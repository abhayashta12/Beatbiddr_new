import { describe, it, expect } from 'vitest';
import { planStatusChange, splitTip, type RequestDoc } from './requestStatus';

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

describe('accept captures the hold and pays the DJ', () => {
  it('captures the tip from the fan', () => {
    const plan = planStatusChange(base, 'dj1', 'accepted');
    expect(plan.status).toBe('accepted');
    expect(plan.capture).toEqual({ requesterId: 'fan1', amount: 25 });
    expect(plan.release).toBeNull();
  });

  it('credits the DJ at the same moment', () => {
    expect(planStatusChange(base, 'dj1', 'accepted').earning).toEqual({
      djId: 'dj1',
      gross: 25,
      fee: 0,
      net: 25,
    });
  });
});

describe('reject releases the hold and pays nobody', () => {
  it('returns the tip to spendable balance', () => {
    const plan = planStatusChange(base, 'dj1', 'rejected');
    expect(plan.release).toEqual({ requesterId: 'fan1', amount: 25 });
    expect(plan.capture).toBeNull();
  });

  it('earns the DJ nothing', () => {
    expect(planStatusChange(base, 'dj1', 'rejected').earning).toBeNull();
  });
});

describe('played moves no money', () => {
  it('is a status change only — we take no position on whether it is played', () => {
    const plan = planStatusChange({ ...base, status: 'accepted' }, 'dj1', 'played');
    expect(plan.status).toBe('played');
    expect(plan.capture).toBeNull();
    expect(plan.release).toBeNull();
    expect(plan.earning).toBeNull();
  });
});

describe('illegal transitions', () => {
  it('will not reject an accepted request — the fan has already paid', () => {
    expect(planStatusChange({ ...base, status: 'accepted' }, 'dj1', 'rejected').error?.status).toBe(409);
  });

  it('will not reject a played request', () => {
    expect(planStatusChange({ ...base, status: 'played' }, 'dj1', 'rejected').error?.status).toBe(409);
  });

  it('will not revive a rejected request', () => {
    expect(planStatusChange({ ...base, status: 'rejected' }, 'dj1', 'accepted').error?.status).toBe(409);
    expect(planStatusChange({ ...base, status: 'rejected' }, 'dj1', 'played').error?.status).toBe(409);
  });

  it('will not re-accept a played request', () => {
    expect(planStatusChange({ ...base, status: 'played' }, 'dj1', 'accepted').error?.status).toBe(409);
  });

  it('treats an unrecognised stored status as pending', () => {
    expect(planStatusChange({ ...base, status: 'weird' }, 'dj1', 'accepted').status).toBe('accepted');
  });
});

describe('double-settlement protection', () => {
  it('accepting an already-accepted request captures and pays nothing', () => {
    const plan = planStatusChange({ ...base, status: 'accepted' }, 'dj1', 'accepted');
    expect(plan.idempotent).toBe(true);
    expect(plan.capture).toBeNull();
    expect(plan.earning).toBeNull();
    expect(plan.error).toBeUndefined();
  });

  it('rejecting an already-rejected request releases nothing', () => {
    const plan = planStatusChange({ ...base, status: 'rejected' }, 'dj1', 'rejected');
    expect(plan.idempotent).toBe(true);
    expect(plan.release).toBeNull();
  });

  it('is idempotent for played too', () => {
    expect(planStatusChange({ ...base, status: 'played' }, 'dj1', 'played').idempotent).toBe(true);
  });
});

describe('splitTip', () => {
  it('gives the DJ everything at 0%', () => {
    expect(splitTip(25, 0)).toEqual({ fee: 0, net: 25 });
  });

  it('splits a clean percentage', () => {
    expect(splitTip(100, 15)).toEqual({ fee: 15, net: 85 });
  });

  it('always sums back to the gross, across awkward amounts and rates', () => {
    // The property that matters: cents must never appear or vanish.
    for (const gross of [0.01, 0.03, 1, 1.01, 3.33, 5, 7.77, 9.99, 10, 19.99, 25, 100, 999.99, 1000]) {
      for (const pct of [0, 1, 2.5, 3, 7, 10, 12.5, 15, 20, 30, 33.3, 50, 99, 100]) {
        const { fee, net } = splitTip(gross, pct);
        expect(Math.round((fee + net) * 100)).toBe(Math.round(gross * 100));
        expect(fee).toBeGreaterThanOrEqual(0);
        expect(net).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never produces sub-cent amounts', () => {
    for (const pct of [3, 7, 12.5, 33.3]) {
      const { fee, net } = splitTip(9.99, pct);
      expect(fee * 100).toBeCloseTo(Math.round(fee * 100), 10);
      expect(net * 100).toBeCloseTo(Math.round(net * 100), 10);
    }
  });

  it('takes everything at 100% and nothing below 0%', () => {
    expect(splitTip(10, 100)).toEqual({ fee: 10, net: 0 });
    expect(splitTip(10, -50)).toEqual({ fee: 0, net: 10 });
    expect(splitTip(10, 150)).toEqual({ fee: 10, net: 0 });
  });

  it('treats a non-finite rate as no fee rather than NaN', () => {
    expect(splitTip(10, Number.NaN)).toEqual({ fee: 0, net: 10 });
  });

  it('returns zeroes for a non-positive gross', () => {
    expect(splitTip(0, 15)).toEqual({ fee: 0, net: 0 });
    expect(splitTip(-5, 15)).toEqual({ fee: 0, net: 0 });
    expect(splitTip(Number.NaN, 15)).toEqual({ fee: 0, net: 0 });
  });
});

describe('platform fee', () => {
  it('takes its cut from the DJ share, not from the fan', () => {
    const plan = planStatusChange({ ...base, tipAmount: 20 }, 'dj1', 'accepted', 10);
    // The fan always pays exactly what they agreed to.
    expect(plan.capture).toEqual({ requesterId: 'fan1', amount: 20 });
    expect(plan.earning).toEqual({ djId: 'dj1', gross: 20, fee: 2, net: 18 });
  });

  it('credits the authenticated caller, never a djId taken from the document', () => {
    expect(planStatusChange(base, 'dj1', 'accepted').earning?.djId).toBe('dj1');
  });
});

describe('settlement eligibility', () => {
  it.each([
    ['a zero tip', 0],
    ['a negative tip', -5],
    ['a non-numeric tip', 'lots' as unknown as number],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('moves no money for %s', (_label, tipAmount) => {
    expect(planStatusChange({ ...base, tipAmount }, 'dj1', 'rejected').release).toBeNull();
    expect(planStatusChange({ ...base, tipAmount }, 'dj1', 'accepted').capture).toBeNull();
    expect(planStatusChange({ ...base, tipAmount }, 'dj1', 'accepted').earning).toBeNull();
  });

  it('settles nothing for an account anonymised by deletion', () => {
    expect(
      planStatusChange({ ...base, requester: { id: 'deleted' } }, 'dj1', 'rejected').release
    ).toBeNull();
    expect(
      planStatusChange({ ...base, requester: { id: 'deleted' } }, 'dj1', 'accepted').capture
    ).toBeNull();
  });

  it('settles nothing when the requester id is missing', () => {
    expect(planStatusChange({ ...base, requester: {} }, 'dj1', 'rejected').release).toBeNull();
    expect(planStatusChange({ ...base, requester: null }, 'dj1', 'rejected').release).toBeNull();
  });

  it('still records the status change when there is nothing to settle', () => {
    expect(planStatusChange({ ...base, tipAmount: 0 }, 'dj1', 'rejected').status).toBe('rejected');
    expect(planStatusChange({ ...base, tipAmount: 0 }, 'dj1', 'accepted').status).toBe('accepted');
  });
});

describe('a fan can never be charged and refunded for the same request', () => {
  it.each(['accepted', 'rejected', 'played'] as const)('%s never both captures and releases', (target) => {
    const from = target === 'played' ? 'accepted' : 'pending';
    const plan = planStatusChange({ ...base, status: from }, 'dj1', target);
    expect(Boolean(plan.capture) && Boolean(plan.release)).toBe(false);
  });
});
