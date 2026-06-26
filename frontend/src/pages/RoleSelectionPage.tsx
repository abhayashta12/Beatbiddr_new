import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Music, Headphones, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const RoleSelectionPage: React.FC = () => {
  const { setUserRole, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<'customer' | 'dj' | null>(null);

  const handleSelect = async (role: 'customer' | 'dj') => {
    setSelected(role);
    setLoading(true);
    try {
      await setUserRole(role);
      navigate(role === 'dj' ? '/dj' : '/customer', { replace: true });
    } catch {
      setLoading(false);
      setSelected(null);
    }
  };

  return (
    <div className="min-h-screen bg-dark-600 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold mb-3">
            Welcome, {user?.displayName?.split(' ')[0]}!
          </h1>
          <p className="text-gray-400 text-lg">How will you be using BeatBiddr?</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onClick={() => handleSelect('customer')}
            disabled={loading}
            className={`card p-8 text-left hover:border-primary-500/50 border-2 transition-all duration-300 disabled:opacity-50 ${
              selected === 'customer' ? 'border-primary-500' : 'border-transparent'
            }`}
          >
            <div className="bg-primary-500/20 rounded-full p-4 w-fit mb-6">
              <Music size={32} className="text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Music Fan</h2>
            <p className="text-gray-400">
              Request songs, tip DJs, and control the vibe at your favorite venues.
            </p>
            {loading && selected === 'customer' && (
              <div className="mt-4 flex items-center text-primary-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-sm">Setting up your account…</span>
              </div>
            )}
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={() => handleSelect('dj')}
            disabled={loading}
            className={`card p-8 text-left hover:border-neon-500/50 border-2 transition-all duration-300 disabled:opacity-50 ${
              selected === 'dj' ? 'border-neon-500' : 'border-transparent'
            }`}
          >
            <div className="bg-neon-500/20 rounded-full p-4 w-fit mb-6">
              <Headphones size={32} className="text-neon-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">DJ / Artist</h2>
            <p className="text-gray-400">
              Manage song requests, accept tips, and connect with your audience in real time.
            </p>
            {loading && selected === 'dj' && (
              <div className="mt-4 flex items-center text-neon-400">
                <Loader2 size={16} className="animate-spin mr-2" />
                <span className="text-sm">Setting up your account…</span>
              </div>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionPage;
