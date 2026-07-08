import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [djProfileComplete, setDjProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);

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

        // Conflict: user already has a role and tried to sign up as a different one
        if (intendedRole && existingRole && intendedRole !== existingRole) {
          sessionStorage.removeItem('intended_role');
          await signOut(auth);
          setUser(null);
          setRole(null);
          setLoading(false);
          const roleLabel = existingRole === 'dj' ? 'DJ / Artist' : 'Music Fan';
          const err = new Error(
            `This Google account is already registered as a ${roleLabel}. ` +
            `To create a different type of account, delete your current profile first.`
          );
          (err as any).code = 'role_conflict';
          throw err;
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
    await signInWithPopup(auth, googleProvider);
  };

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
      value={{ user, role, djProfileComplete, loading, signInWithGoogle, logout, setUserRole, markDjProfileComplete }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
