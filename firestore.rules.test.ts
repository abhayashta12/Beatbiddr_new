import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  setLogLevel,
} from 'firebase/firestore';

/**
 * Tests for firestore.rules, run against the real Firestore emulator.
 *
 * These exist because the rules file was the one piece of security-critical
 * code with no tests, and that is exactly where the worst bug of the project
 * lived: the users create rule was a denylist, so every money field added
 * later was silently writable from a browser. A user could delete their
 * account, recreate it with an invented earnings balance, and withdraw real
 * money.
 *
 * Every rule below is asserted from BOTH sides — what must be allowed, and
 * what must be denied. A rule tested only for the happy path is not tested.
 */

const PROJECT_ID = 'beatbiddr-rules-test';

let testEnv: RulesTestEnvironment;

const FAN = 'fan_alice';
const FAN2 = 'fan_bob';
const DJ = 'dj_spinz';
const DJ2 = 'dj_other';

/** A valid new-account document, exactly as the signup flow writes it. */
const validSignup = {
  name: 'Alice',
  email: 'alice@example.com',
  avatar: 'https://example.com/a.png',
  role: 'customer',
  djProfileComplete: false,
  walletBalance: 0,
  createdAt: '2026-10-22T00:00:00.000Z',
};

beforeAll(async () => {
  // The emulator logs every denied request at warn level; far too noisy when
  // most of these tests are asserting denials on purpose.
  setLogLevel('error');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

/** Seed data as the Admin SDK would, bypassing rules. */
async function seed(fn: (db: any) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

const as = (uid: string) => testEnv.authenticatedContext(uid).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

/* ------------------------------------------------------------------ *
 * users — account creation. This is where SEC-01 lived.
 * ------------------------------------------------------------------ */

describe('users: create', () => {
  it('allows a valid signup for yourself', async () => {
    await assertSucceeds(setDoc(doc(as(FAN), 'users', FAN), validSignup));
  });

  it('allows a signup with no role yet', async () => {
    await assertSucceeds(setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, role: null }));
  });

  it('allows a dj role', async () => {
    await assertSucceeds(setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, role: 'dj' }));
  });

  it('denies creating a document for someone else', async () => {
    await assertFails(setDoc(doc(as(FAN), 'users', FAN2), validSignup));
  });

  it('denies an unauthenticated create', async () => {
    await assertFails(setDoc(doc(anon(), 'users', FAN), validSignup));
  });

  it('denies a non-zero opening balance', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, walletBalance: 500 })
    );
  });

  it('denies claiming a finished DJ profile', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, djProfileComplete: true })
    );
  });

  it('denies an invented role', async () => {
    await assertFails(setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, role: 'admin' }));
  });

  // ---- SEC-01: the actual exploit, asserted field by field ----

  it('DENIES an invented DJ earnings balance at create', async () => {
    await assertFails(
      setDoc(doc(as(DJ), 'users', DJ), {
        ...validSignup,
        role: 'dj',
        djEarningsAvailable: 50000,
      })
    );
  });

  it('DENIES self-asserting payoutsEnabled at create', async () => {
    await assertFails(
      setDoc(doc(as(DJ), 'users', DJ), { ...validSignup, role: 'dj', payoutsEnabled: true })
    );
  });

  it('DENIES supplying your own stripeAccountId at create', async () => {
    await assertFails(
      setDoc(doc(as(DJ), 'users', DJ), {
        ...validSignup,
        role: 'dj',
        stripeAccountId: 'acct_attacker',
      })
    );
  });

  it('DENIES the full SEC-01 payload', async () => {
    // The exact document that would have let someone withdraw real money.
    await assertFails(
      setDoc(doc(as(DJ), 'users', DJ), {
        ...validSignup,
        role: 'dj',
        djEarningsAvailable: 50000,
        djEarningsLifetime: 50000,
        payoutsEnabled: true,
        stripeAccountId: 'acct_attacker',
      })
    );
  });

  it('DENIES pre-loading walletHeld', async () => {
    await assertFails(setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, walletHeld: 999 }));
  });

  it('DENIES a legacy transactions array', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, transactions: [{ amount: 100 }] })
    );
  });

  it('DENIES a smuggled djProfile', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'users', FAN), {
        ...validSignup,
        role: 'dj',
        djProfile: { username: 'stolen', verified: true },
      })
    );
  });

  it('DENIES any unknown field at all — the allowlist must fail closed', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'users', FAN), { ...validSignup, somethingNobodyThoughtOf: true })
    );
  });
});

/* ------------------------------------------------------------------ *
 * users — reads and profile edits
 * ------------------------------------------------------------------ */

describe('users: read', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', FAN), { ...validSignup, walletBalance: 100 });
    });
  });

  it('lets you read your own document', async () => {
    await assertSucceeds(getDoc(doc(as(FAN), 'users', FAN)));
  });

  it('denies reading someone else’s document', async () => {
    await assertFails(getDoc(doc(as(FAN2), 'users', FAN)));
  });

  it('denies an unauthenticated read', async () => {
    await assertFails(getDoc(doc(anon(), 'users', FAN)));
  });
});

describe('users: update', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', FAN), {
        ...validSignup,
        walletBalance: 100,
        walletHeld: 25,
        role: 'customer',
      });
      await setDoc(doc(db, 'users', DJ), {
        ...validSignup,
        role: 'dj',
        djProfileComplete: true,
        djEarningsAvailable: 40,
        payoutsEnabled: true,
        stripeAccountId: 'acct_real',
      });
      await setDoc(doc(db, 'users', FAN2), { ...validSignup, role: null });
    });
  });

  it('allows editing your display name', async () => {
    await assertSucceeds(updateDoc(doc(as(FAN), 'users', FAN), { name: 'Alicia' }));
  });

  it.each([
    ['walletBalance', { walletBalance: 99999 }],
    ['walletHeld', { walletHeld: 0 }],
    ['transactions', { transactions: [] }],
    ['djEarningsAvailable', { djEarningsAvailable: 99999 }],
    ['djEarningsLifetime', { djEarningsLifetime: 99999 }],
    ['stripeAccountId', { stripeAccountId: 'acct_attacker' }],
    ['payoutsEnabled', { payoutsEnabled: true }],
    ['djProfile', { djProfile: { verified: true } }],
    ['djProfileComplete', { djProfileComplete: true }],
    // Added by the chargeback handling. A denylist would have left these open.
    ['disputeCount', { disputeCount: 0 }],
    ['flaggedForReview', { flaggedForReview: false }],
    ['email', { email: 'someone@else.com' }],
    ['createdAt', { createdAt: '1999-01-01T00:00:00.000Z' }],
  ])('denies writing %s from the client', async (_label, patch) => {
    await assertFails(updateDoc(doc(as(FAN), 'users', FAN), patch as any));
  });

  it('denies clearing a fraud flag to rehabilitate yourself', async () => {
    await seed(async (db) => {
      await setDoc(
        doc(db, 'users', FAN),
        { flaggedForReview: true, disputeCount: 3 },
        { merge: true }
      );
    });
    await assertFails(updateDoc(doc(as(FAN), 'users', FAN), { flaggedForReview: false }));
    await assertFails(updateDoc(doc(as(FAN), 'users', FAN), { disputeCount: 0 }));
  });

  it('denies a legitimate field smuggled alongside a name change', async () => {
    // hasOnly must reject the whole write, not just the offending key.
    await assertFails(
      updateDoc(doc(as(FAN), 'users', FAN), { name: 'Alicia', walletBalance: 99999 })
    );
  });

  it('denies an unknown field nobody has thought of yet', async () => {
    await assertFails(updateDoc(doc(as(FAN), 'users', FAN), { isAdmin: true } as any));
  });

  it('denies setting an invented role on a roleless account', async () => {
    await assertFails(updateDoc(doc(as(FAN2), 'users', FAN2), { role: 'admin' }));
  });

  it('denies a DJ raising their own earnings', async () => {
    await assertFails(updateDoc(doc(as(DJ), 'users', DJ), { djEarningsAvailable: 99999 }));
  });

  it('denies a DJ repointing their payout account', async () => {
    await assertFails(updateDoc(doc(as(DJ), 'users', DJ), { stripeAccountId: 'acct_attacker' }));
  });

  it('allows setting a role when none exists yet', async () => {
    await assertSucceeds(updateDoc(doc(as(FAN2), 'users', FAN2), { role: 'dj' }));
  });

  it('denies changing a role that is already set', async () => {
    await assertFails(updateDoc(doc(as(FAN), 'users', FAN), { role: 'dj' }));
  });

  it('denies editing someone else’s profile', async () => {
    await assertFails(updateDoc(doc(as(FAN2), 'users', FAN), { name: 'hacked' }));
  });

  it('denies deleting an account from the client', async () => {
    await assertFails(deleteDoc(doc(as(FAN), 'users', FAN)));
  });
});

/* ------------------------------------------------------------------ *
 * money subcollections — all server-written
 * ------------------------------------------------------------------ */

describe('ledger, earnings and payouts', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', FAN), validSignup);
      await setDoc(doc(db, 'users', FAN, 'ledger', 'e1'), { type: 'deposit', amount: 50 });
      await setDoc(doc(db, 'users', DJ), { ...validSignup, role: 'dj' });
      await setDoc(doc(db, 'users', DJ, 'earnings', 'e1'), { net: 20 });
      await setDoc(doc(db, 'users', DJ, 'payouts', 'p1'), { amount: 20, status: 'paid' });
    });
  });

  it('lets you read your own ledger', async () => {
    await assertSucceeds(getDoc(doc(as(FAN), 'users', FAN, 'ledger', 'e1')));
  });

  it('denies reading someone else’s ledger', async () => {
    await assertFails(getDoc(doc(as(FAN2), 'users', FAN, 'ledger', 'e1')));
  });

  it('denies forging a ledger entry', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'users', FAN, 'ledger', 'forged'), { type: 'deposit', amount: 9999 })
    );
  });

  it('lets a DJ read their own earnings but not write them', async () => {
    await assertSucceeds(getDoc(doc(as(DJ), 'users', DJ, 'earnings', 'e1')));
    await assertFails(setDoc(doc(as(DJ), 'users', DJ, 'earnings', 'forged'), { net: 99999 }));
  });

  it('lets a DJ read their payouts but not create one', async () => {
    await assertSucceeds(getDoc(doc(as(DJ), 'users', DJ, 'payouts', 'p1')));
    await assertFails(
      setDoc(doc(as(DJ), 'users', DJ, 'payouts', 'forged'), { amount: 99999, status: 'paid' })
    );
  });

  it('denies a DJ reading another DJ’s earnings', async () => {
    await assertFails(getDoc(doc(as(DJ2), 'users', DJ, 'earnings', 'e1')));
  });
});

/* ------------------------------------------------------------------ *
 * songRequests — the privacy boundary
 * ------------------------------------------------------------------ */

describe('songRequests', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'songRequests', 'r1'), {
        djId: DJ,
        requester: { id: FAN, name: 'Alice' },
        song: { title: 'Song', artist: 'Artist' },
        tipAmount: 25,
        message: 'private message to the DJ',
        status: 'pending',
        timestamp: '2026-10-22T00:00:00.000Z',
      });
    });
  });

  it('lets the fan who sent it read it', async () => {
    await assertSucceeds(getDoc(doc(as(FAN), 'songRequests', 'r1')));
  });

  it('lets the DJ it was sent to read it', async () => {
    await assertSucceeds(getDoc(doc(as(DJ), 'songRequests', 'r1')));
  });

  it('denies an unrelated fan reading it — name and message are private', async () => {
    await assertFails(getDoc(doc(as(FAN2), 'songRequests', 'r1')));
  });

  it('denies an unrelated DJ reading it', async () => {
    await assertFails(getDoc(doc(as(DJ2), 'songRequests', 'r1')));
  });

  it('denies an unauthenticated read', async () => {
    await assertFails(getDoc(doc(anon(), 'songRequests', 'r1')));
  });

  it('denies creating a request from the client — it would skip the debit', async () => {
    await assertFails(
      setDoc(doc(as(FAN), 'songRequests', 'free'), {
        djId: DJ,
        requester: { id: FAN },
        tipAmount: 500,
        status: 'accepted',
      })
    );
  });

  it('denies the DJ changing status directly — refunds must go through the API', async () => {
    await assertFails(updateDoc(doc(as(DJ), 'songRequests', 'r1'), { status: 'accepted' }));
  });

  it('denies a fan rewriting their own tip', async () => {
    await assertFails(updateDoc(doc(as(FAN), 'songRequests', 'r1'), { tipAmount: 1 }));
  });

  it('denies deleting a request', async () => {
    await assertFails(deleteDoc(doc(as(DJ), 'songRequests', 'r1')));
  });

  it('allows a query scoped to your own requests', async () => {
    await assertSucceeds(
      getDocs(query(collection(as(FAN), 'songRequests'), where('requester.id', '==', FAN)))
    );
  });

  it('allows a DJ querying their own requests', async () => {
    await assertSucceeds(
      getDocs(query(collection(as(DJ), 'songRequests'), where('djId', '==', DJ)))
    );
  });

  it('DENIES an unscoped query — this is what forces per-user scoping', async () => {
    await assertFails(getDocs(collection(as(FAN), 'songRequests')));
  });

  it('denies querying another fan’s requests', async () => {
    await assertFails(
      getDocs(query(collection(as(FAN2), 'songRequests'), where('requester.id', '==', FAN)))
    );
  });

  it('denies a DJ querying another DJ’s requests', async () => {
    await assertFails(
      getDocs(query(collection(as(DJ2), 'songRequests'), where('djId', '==', DJ)))
    );
  });
});

/* ------------------------------------------------------------------ *
 * public and internal collections
 * ------------------------------------------------------------------ */

describe('djs directory', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'djs', DJ), {
        uid: DJ,
        username: 'spinz',
        stageName: 'DJ Spinz',
        club: 'Neon',
        isLive: true,
        verified: false,
      });
    });
  });

  it('is readable by any signed-in user', async () => {
    await assertSucceeds(getDoc(doc(as(FAN), 'djs', DJ)));
  });

  it('is not readable anonymously', async () => {
    await assertFails(getDoc(doc(anon(), 'djs', DJ)));
  });

  it('denies a DJ editing their own public entry', async () => {
    // Would let them set verified: true, or rename themselves past validation.
    await assertFails(updateDoc(doc(as(DJ), 'djs', DJ), { verified: true }));
  });

  it('denies creating an entry for yourself', async () => {
    await assertFails(setDoc(doc(as(DJ2), 'djs', DJ2), { stageName: 'Fake', verified: true }));
  });
});

describe('queueEntries', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'queueEntries', 'r1'), {
        djId: DJ,
        status: 'accepted',
        tipAmount: 25,
        title: 'Song',
        artist: 'Artist',
      });
    });
  });

  it('is readable so a fan can work out their place in line', async () => {
    await assertSucceeds(getDoc(doc(as(FAN), 'queueEntries', 'r1')));
  });

  it('carries no requester identity', async () => {
    const snap = await getDoc(doc(as(FAN), 'queueEntries', 'r1'));
    const data = snap.data() ?? {};
    if ('requester' in data || 'message' in data) {
      throw new Error('queueEntries must never carry requester identity or messages');
    }
  });

  it('denies client writes', async () => {
    await assertFails(updateDoc(doc(as(DJ), 'queueEntries', 'r1'), { status: 'played' }));
    await assertFails(setDoc(doc(as(FAN), 'queueEntries', 'forged'), { djId: DJ, tipAmount: 1 }));
  });
});

describe('djUsernames', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'djUsernames', 'spinz'), { uid: DJ, claimedAt: 'now' });
    });
  });

  it('is readable so signup can show availability', async () => {
    await assertSucceeds(getDoc(doc(as(DJ2), 'djUsernames', 'spinz')));
  });

  it('denies claiming a username from the client', async () => {
    await assertFails(setDoc(doc(as(DJ2), 'djUsernames', 'newname'), { uid: DJ2 }));
  });

  it('denies stealing an existing username', async () => {
    await assertFails(updateDoc(doc(as(DJ2), 'djUsernames', 'spinz'), { uid: DJ2 }));
  });
});

describe('rateLimits', () => {
  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'rateLimits', `search:${FAN}`), { count: 60 });
    });
  });

  it('denies reading your own remaining budget', async () => {
    await assertFails(getDoc(doc(as(FAN), 'rateLimits', `search:${FAN}`)));
  });

  it('denies resetting your own counter', async () => {
    await assertFails(setDoc(doc(as(FAN), 'rateLimits', `search:${FAN}`), { count: 0 }));
  });
});

/* ------------------------------------------------------------------ *
 * anything not explicitly matched must be denied
 * ------------------------------------------------------------------ */

describe('unmatched paths fail closed', () => {
  it.each(['admins', 'config', 'secrets', 'platformBalance', 'anythingElse'])(
    'denies reads and writes on /%s',
    async (path) => {
      await assertFails(getDoc(doc(as(FAN), path, 'x')));
      await assertFails(setDoc(doc(as(FAN), path, 'x'), { a: 1 }));
    }
  );
});
