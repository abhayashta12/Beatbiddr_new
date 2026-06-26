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
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setUserRole: (role: 'customer' | 'dj') => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          setRole((snap.data().role as UserRole) ?? null);
        } else {
          await setDoc(userRef, {
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            avatar: firebaseUser.photoURL,
            role: null,
            walletBalance: 0,
            createdAt: new Date().toISOString(),
          });
          setRole(null);
        }
      } else {
        setRole(null);
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
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { role: newRole });
    setRole(newRole);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, logout, setUserRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
