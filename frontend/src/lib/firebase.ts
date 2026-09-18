import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Sign-in has to happen on our own origin.
 *
 * Firebase defaults authDomain to <project>.firebaseapp.com. Modern mobile
 * browsers partition storage per top-level site, so state Firebase parks on
 * that domain during sign-in is unreadable when the user lands back on
 * beatbiddr.com — the sign-in completes at Google and then silently appears
 * never to have happened.
 *
 * vercel.json proxies /__/auth/* through to the Firebase handler, so pointing
 * authDomain at our own host keeps the whole flow first-party. Only applied to
 * domains we actually proxy; anywhere else keeps the configured value.
 */
const PROXIED_HOSTS = ['beatbiddr.com', 'www.beatbiddr.com'];

const resolveAuthDomain = (): string => {
  const configured = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string;
  if (typeof window === 'undefined') return configured;
  return PROXIED_HOSTS.includes(window.location.hostname)
    ? window.location.hostname
    : configured;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
