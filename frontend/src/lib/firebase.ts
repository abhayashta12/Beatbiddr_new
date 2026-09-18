import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// authDomain must stay as Firebase issued it. Google only accepts redirect
// URIs registered on the OAuth client, and the registered one is
// <project>.firebaseapp.com/__/auth/handler — pointing this at our own domain
// makes Google reject the sign-in with "this app's request is invalid".
//
// Sign-in uses a popup, which keeps the page alive and does not depend on
// reading storage from that domain, so the cross-site restrictions that break
// redirect sign-in on phones do not apply.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
