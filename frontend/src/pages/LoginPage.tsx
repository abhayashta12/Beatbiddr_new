import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Music, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/layout/Navbar';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // AuthContext sets role; App.tsx redirects based on role.
      // If role is null → /select-role; else → /dj or /customer
      navigate('/select-role', { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Please enable popups for this site to sign in with Google.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-600">
      <Navbar />
      <div className="flex items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="card p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-primary-500/20 rounded-full p-4">
                  <Music size={40} className="text-primary-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to BeatBiddr</h2>
              <p className="text-gray-400">Sign in to request songs and tip your favorite DJs</p>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center space-x-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn size={20} />
              )}
              <span>{loading ? 'Signing in…' : 'Sign in with Google'}</span>
            </button>

            <div className="mt-6 text-center text-sm text-gray-400">
              <p>By signing in, you agree to our</p>
              <div className="mt-1 space-x-2">
                <button className="text-primary-400 hover:text-primary-300">Terms of Service</button>
                <span>&</span>
                <button className="text-primary-400 hover:text-primary-300">Privacy Policy</button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
