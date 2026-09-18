import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth, storeIntendedRole } from '../contexts/AuthContext';

type IntendedRole = 'customer' | 'dj' | null;

const LoginPage: React.FC = () => {
  const { user, role, signInWithGoogle, setUserRole, authError, clearAuthError } = useAuth();
  const [intendedRole, setIntendedRole] = useState<IntendedRole>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const error = authError ?? localError;

  // Signed in but no role yet — assign it directly, no second trip to Google.
  const needsRoleOnly = Boolean(user) && role === null;

  const handleContinue = async () => {
    if (!intendedRole) return;
    setLocalError(null);
    clearAuthError();
    setLoading(true);

    try {
      if (needsRoleOnly) {
        await setUserRole(intendedRole);
        return;
      }
      storeIntendedRole(intendedRole);
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed:', err);
      setLocalError(
        needsRoleOnly
          ? 'Could not save your role. Please try again.'
          : 'Could not sign in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const options: { value: 'customer' | 'dj'; title: string; blurb: string }[] = [
    {
      value: 'customer',
      title: 'Music fan',
      blurb: 'Request songs and tip to jump the queue.',
    },
    {
      value: 'dj',
      title: 'DJ or artist',
      blurb: 'Take requests and get paid while you play.',
    },
  ];

  return (
    <div className="app-shell bg-dark-600">
      <div className="app-scroll safe-top">
        <div className="px-6 pt-16 pb-8 flex flex-col min-h-full max-w-md mx-auto w-full">
          <header>
            <h1 className="text-[32px] font-extrabold tracking-[-0.04em] leading-[1.05]">
              {needsRoleOnly
                ? `Almost there${
                    user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''
                  }.`
                : 'BeatBiddr'}
            </h1>
            <p className="text-[14.5px] muted mt-2.5 leading-relaxed max-w-[32ch]">
              {needsRoleOnly
                ? 'Pick how you want to use BeatBiddr to finish setting up.'
                : 'Request songs from live DJs. Tip to hear yours sooner.'}
            </p>
          </header>

          <div className="rule mt-8" />

          {/* role choice */}
          <div className="flex flex-col">
            {options.map((opt) => {
              const active = intendedRole === opt.value;
              return (
                <React.Fragment key={opt.value}>
                  <button
                    onClick={() => setIntendedRole(opt.value)}
                    aria-pressed={active}
                    className="flex items-start gap-3.5 py-5 text-left w-full"
                  >
                    <span
                      className={`mt-1 w-[18px] h-[18px] rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                        active ? 'border-white' : 'border-white/25'
                      }`}
                    >
                      {active && <span className="w-2.5 h-2.5 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span
                        className={`block text-[16px] font-bold tracking-[-0.02em] ${
                          active ? 'text-white' : 'text-neutral-300'
                        }`}
                      >
                        {opt.title}
                      </span>
                      <span className="block text-[13px] muted mt-0.5 leading-relaxed">
                        {opt.blurb}
                      </span>
                    </span>
                  </button>
                  <div className="rule" />
                </React.Fragment>
              );
            })}
          </div>

          {error && (
            <p className="text-[13.5px] text-red-400 mt-5 leading-relaxed">{error}</p>
          )}

          <div className="mt-auto pt-10 flex flex-col gap-4">
            <button
              onClick={handleContinue}
              disabled={!intendedRole || loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : needsRoleOnly ? (
                'Finish setup'
              ) : (
                'Continue with Google'
              )}
            </button>

            <p className="text-[11.5px] muted text-center leading-relaxed">
              One role per account. Signing in means you accept our terms and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
