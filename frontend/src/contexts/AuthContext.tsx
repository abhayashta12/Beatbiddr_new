import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { doc, updateDoc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'customer' | 'dj' | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  djProfileComplete: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setUserRole: (role: 'customer' | 'dj') => Promise<void>;
  markDjProfileComplete: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const googleProvider = new GoogleAuthProvider();
// Always show the account chooser — without this, Google silently reuses the
// last signed-in account, so users can never pick a different one.
googleProvider.setCustomParameters({ prompt: 'select_account' });

// The role a user picked before signing in must survive the full-page redirect
// to Google and back. sessionStorage is dropped by iOS Safari and in-app
// browsers during that hop, so use localStorage with a short expiry instead
// (an abandoned signup must not trigger a false role conflict days later).
const INTENDED_ROLE_KEY = 'beatbiddr_intended_role';
const INTENDED_ROLE_TTL_MS = 15 * 60 * 1000;

export const storeIntendedRole = (role: 'customer' | 'dj') => {
  localStorage.setItem(INTENDED_ROLE_KEY, JSON.stringify({ role, ts: Date.now() }));
};

const readIntendedRole = (): UserRole => {
  const raw = localStorage.getItem(INTENDED_ROLE_KEY);
  if (!raw) return null;
  try {
    const { role, ts } = JSON.parse(raw);
    if (Date.now() - ts > INTENDED_ROLE_TTL_MS) return null;
    return role as UserRole;
  } catch {
    return null;
  }
};

const clearIntendedRole = () => localStorage.removeItem(INTENDED_ROLE_KEY);

interface BootstrapResult {
  role: UserRole;
  djProfileComplete: boolean;
  /** Set when the account already holds a different role than the one requested. */
  conflictWith?: 'customer' | 'dj';
}

/**
 * Resolves a signed-in user's account state in a single atomic transaction.
 *
 * onAuthStateChanged can fire more than once for one sign-in (sign-in event,
 * token refresh, a second tab observing the shared auth state). Doing a
 * read-then-write outside a transaction let two invocations interleave, and a
 * plain setDoc from the loser overwrote the winner's role with null. Firestore
 * retries this transaction on contention, so the second run observes the
 * document the first one created and takes the "already exists" path instead.
 *
 * Invariant: a non-null role is never overwritten, and null is never written
 * over an existing role.
 */
const bootstrapUser = async (
  firebaseUser: User,
  intendedRole: UserRole
): Promise<BootstrapResult> => {
  const userRef = doc(db, 'users', firebaseUser.uid);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);

    if (!snap.exists()) {
      const newRole = intendedRole ?? null;
      tx.set(userRef, {
        name: firebaseUser.displayName,
        email: firebaseUser.email,
        avatar: firebaseUser.photoURL,
        role: newRole,
        djProfileComplete: false,
        walletBalance: 0,
        createdAt: new Date().toISOString(),
      });
      return { role: newRole, djProfileComplete: false };
    }

    const data = snap.data();
    const existingRole = (data.role as UserRole) ?? null;
    const djProfileComplete = data.djProfileComplete === true;

    if (existingRole) {
      return {
        role: existingRole,
        djProfileComplete,
        conflictWith:
          intendedRole && intendedRole !== existingRole ? existingRole : undefined,
      };
    }

    // Account exists without a role (a signup that never finished). Complete it
    // rather than leaving the user stranded on the login screen.
    if (intendedRole) {
      tx.update(userRef, { role: intendedRole });
      return { role: intendedRole, djProfileComplete };
    }

    return { role: null, djProfileComplete };
  });
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [djProfileComplete, setDjProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const bootstrappingUid = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        bootstrappingUid.current = null;
        setUser(null);
        setRole(null);
        setDjProfileComplete(false);
        setLoading(false);
        return;
      }

      // A duplicate event for the same user must not start a second bootstrap.
      if (bootstrappingUid.current === firebaseUser.uid) return;
      bootstrappingUid.current = firebaseUser.uid;

      try {
        const intendedRole = readIntendedRole();
        const result = await bootstrapUser(firebaseUser, intendedRole);

        // Only now is the choice durably recorded — clearing any earlier would
        // lose it if the write failed or a concurrent event was still reading it.
        clearIntendedRole();

        if (result.conflictWith) {
          await signOut(auth);
          setUser(null);
          setRole(null);
          setDjProfileComplete(false);
          const roleLabel = result.conflictWith === 'dj' ? 'DJ / Artist' : 'Music Fan';
          setAuthError(
            `This Google account is already registered as a ${roleLabel}. ` +
            `To create a different type of account, delete your current profile first.`
          );
          return;
        }

        setUser(firebaseUser);
        setRole(result.role);
        setDjProfileComplete(result.djProfileComplete);
      } catch (err) {
        console.error('Failed to load account:', err);
        // Leave the stored role intact so the next attempt can still apply it.
        setUser(firebaseUser);
        setAuthError('Could not load your account. Please refresh and try again.');
      } finally {
        bootstrappingUid.current = null;
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    // Popups are unreliable on mobile browsers (blocked or orphaned, leaving the
    // button spinning forever) — use the full-page redirect flow there instead.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  };

  const clearAuthError = () => setAuthError(null);

  const logout = async () => {
    await signOut(auth);
  };

  const setUserRole = async (newRole: 'customer' | 'dj') => {
    if (!user) return;
    // Only allow setting role if none exists yet (no switching roles)
    if (role !== null) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { role: newRole });
    setRole(newRole);
  };

  const markDjProfileComplete = () => setDjProfileComplete(true);

  return (
    <AuthContext.Provider
      value={{ user, role, djProfileComplete, loading, authError, clearAuthError, signInWithGoogle, logout, setUserRole, markDjProfileComplete }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
