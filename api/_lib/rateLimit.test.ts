import { describe, it, expect } from 'vitest';
import { decideRateLimit } from './rateLimit';

const NOW = 1_000_000;
const LIMIT = 20;
const WINDOW = 300; // seconds

describe('starting a window', () => {
  it('starts one when no counter exists', () => {
    expect(decideRateLimit(null, 0, NOW, LIMIT, WINDOW)).toEqual({ kind: 'start-window' });
  });

  it('starts a fresh one exactly at the boundary', () => {
    expect(decideRateLimit(NOW - WINDOW * 1000, LIMIT, NOW, LIMIT, WINDOW)).toEqual({
      kind: 'start-window',
    });
  });

  it('starts a fresh one well after the window', () => {
    expect(decideRateLimit(NOW - WINDOW * 2000, LIMIT, NOW, LIMIT, WINDOW)).toEqual({
      kind: 'start-window',
    });
  });
});

describe('inside the window', () => {
  it('increments while under the limit', () => {
    expect(decideRateLimit(NOW - 1000, LIMIT - 1, NOW, LIMIT, WINDOW)).toEqual({
      kind: 'increment',
    });
  });

  it('refuses once the limit is reached', () => {
    const d = decideRateLimit(NOW - 1000, LIMIT, NOW, LIMIT, WINDOW);
    expect(d.kind).toBe('refuse');
  });

  it('refuses a count that somehow exceeded the limit', () => {
    expect(decideRateLimit(NOW - 1000, LIMIT + 50, NOW, LIMIT, WINDOW).kind).toBe('refuse');
  });

  it('allows exactly `limit` calls and no more', () => {
    let allowed = 0;
    let count = 0;
    for (let i = 0; i < LIMIT + 5; i++) {
      const d = decideRateLimit(NOW, count, NOW + i, LIMIT, WINDOW);
      if (d.kind === 'increment') {
        count++;
        allowed++;
      } else if (d.kind === 'start-window') {
        count = 1;
        allowed++;
      }
    }
    expect(allowed).toBe(LIMIT);
  });
});

describe('retryAfter', () => {
  it('never reports 0, which would invite an instant retry', () => {
    // 1ms left in the window
    const d = decideRateLimit(NOW - (WINDOW * 1000 - 1), LIMIT, NOW, LIMIT, WINDOW);
    expect(d.kind).toBe('refuse');
    if (d.kind === 'refuse') expect(d.retryAfter).toBe(1);
  });

  it('reports the full window when refused immediately', () => {
    const d = decideRateLimit(NOW, LIMIT, NOW, LIMIT, WINDOW);
    if (d.kind === 'refuse') expect(d.retryAfter).toBe(WINDOW);
  });

  it('never exceeds the window length', () => {
    for (let elapsed = 0; elapsed < WINDOW * 1000; elapsed += 7919) {
      const d = decideRateLimit(NOW - elapsed, LIMIT, NOW, LIMIT, WINDOW);
      if (d.kind === 'refuse') {
        expect(d.retryAfter).toBeGreaterThanOrEqual(1);
        expect(d.retryAfter).toBeLessThanOrEqual(WINDOW);
      }
    }
  });
});

describe('clock skew', () => {
  it('fails closed on a windowStart in the future', () => {
    // Negative elapsed must not be read as an expired window.
    expect(decideRateLimit(NOW + 600_000, LIMIT, NOW, LIMIT, WINDOW).kind).toBe('refuse');
  });

  it('recovers once real time passes the skewed window', () => {
    const skewed = NOW + 600_000;
    expect(decideRateLimit(skewed, LIMIT, skewed + WINDOW * 1000, LIMIT, WINDOW)).toEqual({
      kind: 'start-window',
    });
  });
});
