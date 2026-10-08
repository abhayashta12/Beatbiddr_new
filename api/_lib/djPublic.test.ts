import { describe, it, expect } from 'vitest';
import { buildDJPublic } from './djPublic';

/**
 * djs/{uid} is readable by every signed-in user. users/{uid}.djProfile holds
 * legal name, phone, address and email. The only thing standing between the
 * two is this function.
 */

// Exactly what api/complete-dj-profile.ts writes.
const fullProfile = {
  username: 'dj_spinz',
  stageName: 'DJ Spinz',
  legalName: 'John Smith',
  phone: '+1 555 123 4567',
  address: '123 Main St, Toronto, ON',
  club: 'Neon Lounge',
  email: 'john@example.com',
  verified: false,
  isLive: true,
};

describe('the public mirror never leaks identity', () => {
  it('publishes exactly six fields', () => {
    expect(Object.keys(buildDJPublic('uid123', fullProfile)).sort()).toEqual([
      'club',
      'isLive',
      'stageName',
      'uid',
      'username',
      'verified',
    ]);
  });

  it.each(['legalName', 'phone', 'address', 'email'])('omits %s entirely', (field) => {
    const pub = buildDJPublic('uid123', fullProfile) as Record<string, unknown>;
    expect(field in pub).toBe(false);
  });

  it.each(['legalName', 'phone', 'address', 'email'] as const)(
    'the %s value appears nowhere in the serialised output',
    (field) => {
      const serialised = JSON.stringify(buildDJPublic('uid123', fullProfile));
      expect(serialised).not.toContain(String(fullProfile[field]));
    }
  );

  it('is an allowlist, so unknown fields cannot ride along', () => {
    const pub = buildDJPublic('uid123', {
      ...fullProfile,
      ssn: '000-00-0000',
      walletBalance: 99999,
      role: 'admin',
    }) as Record<string, unknown>;
    expect('ssn' in pub).toBe(false);
    expect('walletBalance' in pub).toBe(false);
    expect('role' in pub).toBe(false);
  });
});

describe('type coercion', () => {
  it('turns non-string fields into empty strings rather than publishing objects', () => {
    const pub = buildDJPublic('u', {
      username: { toString: () => 'evil' },
      stageName: 42,
      club: null,
    });
    expect(pub.username).toBe('');
    expect(pub.stageName).toBe('');
    expect(pub.club).toBe('');
  });

  it('requires strict true for isLive, so a truthy string cannot show a DJ as live', () => {
    expect(buildDJPublic('u', { isLive: 'yes' }).isLive).toBe(false);
    expect(buildDJPublic('u', { isLive: 1 }).isLive).toBe(false);
    expect(buildDJPublic('u', { isLive: true }).isLive).toBe(true);
  });

  it('requires strict true for verified, so nobody is accidentally badged', () => {
    expect(buildDJPublic('u', { verified: 1 }).verified).toBe(false);
    expect(buildDJPublic('u', { verified: 'true' }).verified).toBe(false);
    expect(buildDJPublic('u', { verified: true }).verified).toBe(true);
  });

  it('yields a safe, filterable document for an empty profile', () => {
    const pub = buildDJPublic('u', {});
    expect(pub.stageName).toBe('');
    expect(pub.isLive).toBe(false);
  });
});
