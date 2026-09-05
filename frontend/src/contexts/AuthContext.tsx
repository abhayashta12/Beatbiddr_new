import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [djProfileComplete, setDjProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setDjProfileComplete(false);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);
      const intendedRole = sessionStorage.getItem('intended_role') as UserRole;

      if (snap.exists()) {
        const existingRole = (snap.data().role as UserRole) ?? null;

        // Conflict: user already has a role and tried to sign up as a different one.
        // Surface it via state — a throw here is unhandled (listener context) and
        // with the mobile redirect flow there is no caller to catch it anyway.
        if (intendedRole && existingRole && intendedRole !== existingRole) {
          sessionStorage.removeItem('intended_role');
          await signOut(auth);
          setUser(null);
          setRole(null);
          setLoading(false);
          const roleLabel = existingRole === 'dj' ? 'DJ / Artist' : 'Music Fan';
          setAuthError(
            `This Google account is already registered as a ${roleLabel}. ` +
            `To create a different type of account, delete your current profile first.`
          );
          return;
        }

        sessionStorage.removeItem('intended_role');
        setUser(firebaseUser);
        setRole(existingRole);
        setDjProfileComplete(snap.data().djProfileComplete === true);
      } else {
        // Brand new user — apply the intended role immediately.
        // DJs must complete onboarding (username, contact info) before using the app.
        const newRole = intendedRole ?? null;
        sessionStorage.removeItem('intended_role');

        await setDoc(userRef, {
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          avatar: firebaseUser.photoURL,
          role: newRole,
          djProfileComplete: false,
          walletBalance: 0,
          createdAt: new Date().toISOString(),
        });

        setUser(firebaseUser);
        setRole(newRole);
        setDjProfileComplete(false);
      }

      setLoading(false);
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
