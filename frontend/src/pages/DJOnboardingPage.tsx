import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Headphones, AlertCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/layout/Navbar';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const DJOnboardingPage: React.FC = () => {
  const { user, markDjProfileComplete } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [stageName, setStageName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [club, setClub] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalizedUsername = username.trim().toLowerCase();

  const checkUsername = async () => {
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setUsernameStatus('invalid');
      return false;
    }
    setUsernameStatus('checking');
    const snap = await getDoc(doc(db, 'djUsernames', normalizedUsername));
    const available = !snap.exists();
    setUsernameStatus(available ? 'available' : 'taken');
    return available;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setError('Username must be 3–20 characters: lowercase letters, numbers, and underscores only.');
      return;
    }
    if (!stageName.trim() || !legalName.trim() || !phone.trim() || !address.trim()) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^\+?[\d\s\-()]{7,15}$/.test(phone.trim())) {
      setError('Please enter a valid phone number.');
      return;
    }

    setSubmitting(true);
    try {
      // Re-check availability right before claiming
      const available = await checkUsername();
      if (!available) {
        setError(`Username "${normalizedUsername}" is already taken. Please choose another.`);
        setSubmitting(false);
        return;
      }

      // Atomic claim: username reservation + profile update in one batch.
      // Firestore rules reject the batch if the username doc already exists,
      // so two simultaneous claims can never both succeed.
      const batch = writeBatch(db);
      batch.set(doc(db, 'djUsernames', normalizedUsername), {
        uid: user.uid,
        claimedAt: new Date().toISOString(),
      });
      batch.update(doc(db, 'users', user.uid), {
        djProfile: {
          username: normalizedUsername,
          stageName: stageName.trim(),
          legalName: legalName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          club: club.trim(),
          email: user.email,
          verified: false,
        },
        djProfileComplete: true,
      });
      await batch.commit();

      markDjProfileComplete();
      navigate('/dj', { replace: true });
    } catch (err) {
      console.error('DJ onboarding failed:', err);
      setError('Something went wrong saving your profile. Please try again.');
    } finally {
      setSubmitting(false);
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
          className="w-full max-w-lg"
        >
          <div className="card p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-neon-500/20 rounded-full p-4">
                  <Headphones size={36} className="text-neon-400" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Set Up Your DJ Profile</h1>
              <p className="text-gray-400 text-sm">
                We need a few details to verify you're a real DJ. Your username is permanent and unique.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">@</span>
                  <input
                    type="text"
                    className="input pl-8 w-full"
                    placeholder="dj_spinz"
                    value={username}
                    maxLength={20}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameStatus('idle');
                    }}
                    onBlur={() => normalizedUsername && checkUsername()}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-gray-400" />}
                    {usernameStatus === 'available' && <CheckCircle size={16} className="text-neon-400" />}
                    {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle size={16} className="text-red-400" />}
                  </span>
                </div>
                {usernameStatus === 'taken' && (
                  <p className="text-xs text-red-400 mt-1">This username is already taken.</p>
                )}
                {usernameStatus === 'invalid' && (
                  <p className="text-xs text-red-400 mt-1">3–20 characters: lowercase letters, numbers, underscores.</p>
                )}
                {usernameStatus === 'available' && (
                  <p className="text-xs text-neon-400 mt-1">Username is available!</p>
                )}
              </div>

              {/* Stage name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Stage / DJ Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="DJ Spinz"
                  value={stageName}
                  maxLength={50}
                  onChange={(e) => setStageName(e.target.value)}
                />
              </div>

              {/* Legal name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Full Legal Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="John Smith"
                  value={legalName}
                  maxLength={100}
                  onChange={(e) => setLegalName(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  className="input w-full"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="123 Main St, Toronto, ON"
                  value={address}
                  maxLength={200}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {/* Club (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Venue / Club You Play At <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Neon Lounge"
                  value={club}
                  maxLength={100}
                  onChange={(e) => setClub(e.target.value)}
                />
              </div>

              {/* Email — read only, comes from Google */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input type="email" className="input w-full opacity-60" value={user?.email ?? ''} disabled />
                <p className="text-xs text-gray-500 mt-1">Linked to your Google account.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary flex items-center justify-center disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Creating profile…
                  </>
                ) : (
                  'Complete DJ Profile'
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DJOnboardingPage;
