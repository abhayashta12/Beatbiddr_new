import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Music, Headphones, AlertCircle, LogIn } from 'lucide-react';
import { useAuth, storeIntendedRole } from '../contexts/AuthContext';
import Navbar from '../components/layout/Navbar';

type IntendedRole = 'customer' | 'dj' | null;

const LoginPage: React.FC = () => {
  const { user, role, signInWithGoogle, setUserRole, authError, clearAuthError } = useAuth();
  const [intendedRole, setIntendedRole] = useState<IntendedRole>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Role conflicts surface via AuthContext (works for both popup and redirect flows)
  const error = authError ?? localError;

  // Already signed in but with no role — signup was interrupted, or the picked
  // role was lost across the redirect. Assign it directly, no Google round-trip.
  const needsRoleOnly = Boolean(user) && role === null;

  const handleContinue = async () => {
    if (!intendedRole) return;
    setLocalError(null);
    clearAuthError();
    setLoading(true);

    try {
      if (needsRoleOnly) {
        await setUserRole(intendedRole);
        return; // App.tsx redirects once role state updates
      }

      storeIntendedRole(intendedRole);
      await signInWithGoogle();
      // AuthContext handles role assignment and conflict detection.
      // Redirect happens in App.tsx based on role state. On mobile this
      // navigates away to Google and back.
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      setLocalError(
        needsRoleOnly
          ? 'Could not save your role. Please try again.'
          : 'Failed to sign in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-600">
      <Navbar />
      <div className="flex items-center justify-center min-h-screen px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <div className="bg-primary-500/20 rounded-full p-4">
                <Music size={40} className="text-primary-400" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2">
              {needsRoleOnly
                ? `Almost there${user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!`
                : 'Welcome to BeatBiddr'}
            </h2>
            <p className="text-gray-400">
              {needsRoleOnly
                ? 'Just pick how you want to use BeatBiddr to finish setting up.'
                : 'How will you be using BeatBiddr?'}
            </p>
          </div>

          {/* Role cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              onClick={() => setIntendedRole('customer')}
              className={`card p-8 text-left border-2 transition-all duration-300 ${
                intendedRole === 'customer'
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-transparent hover:border-primary-500/40'
              }`}
            >
              <div className="bg-primary-500/20 rounded-full p-4 w-fit mb-6">
                <Music size={32} className="text-primary-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Music Fan</h3>
              <p className="text-gray-400 text-sm">
                Request songs, tip DJs, and control the vibe at your favorite venues.
              </p>
              {intendedRole === 'customer' && (
                <div className="mt-4 text-xs text-primary-400 font-medium">✓ Selected</div>
              )}
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              onClick={() => setIntendedRole('dj')}
              className={`card p-8 text-left border-2 transition-all duration-300 ${
                intendedRole === 'dj'
                  ? 'border-neon-500 bg-neon-500/10'
                  : 'border-transparent hover:border-neon-500/40'
              }`}
            >
              <div className="bg-neon-500/20 rounded-full p-4 w-fit mb-6">
                <Headphones size={32} className="text-neon-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">DJ / Artist</h3>
              <p className="text-gray-400 text-sm">
                Manage song requests, accept tips, and connect with your audience in real time.
              </p>
              {intendedRole === 'dj' && (
                <div className="mt-4 text-xs text-neon-400 font-medium">✓ Selected</div>
              )}
            </motion.button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Sign in button — only active after role is chosen */}
          <button
            onClick={handleContinue}
            disabled={!intendedRole || loading}
            className="w-full btn-primary flex items-center justify-center space-x-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <LogIn size={20} />
            )}
            <span>
              {loading
                ? needsRoleOnly
                  ? 'Setting up…'
                  : 'Signing in…'
                : !intendedRole
                ? 'Select a role above to continue'
                : needsRoleOnly
                ? `Continue as ${intendedRole === 'dj' ? 'DJ / Artist' : 'Music Fan'}`
                : `Continue as ${intendedRole === 'dj' ? 'DJ / Artist' : 'Music Fan'} with Google`}
            </span>
          </button>

          <p className="mt-6 text-center text-xs text-gray-500">
            Each Google account can only hold one role. To switch roles you must delete your current
            profile first.
          </p>

          <div className="mt-4 text-center text-sm text-gray-400">
            <p>By signing in, you agree to our</p>
            <div className="mt-1 space-x-2">
              <button className="text-primary-400 hover:text-primary-300">Terms of Service</button>
              <span>&</span>
              <button className="text-primary-400 hover:text-primary-300">Privacy Policy</button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
