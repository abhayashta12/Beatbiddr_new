import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { clearSpotifyToken } from '../utils/spotifyAuth';

const ProfilePage: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    clearSpotifyToken();
    await logout();
    navigate('/');
  };

  const rows = [
    { label: 'Account', value: user?.email ?? '—' },
    { label: 'Role', value: role === 'dj' ? 'DJ / Artist' : 'Music Fan' },
  ];

  return (
    <AppShell>
      <div className="px-6 pt-6 pb-8 flex flex-col min-h-full">
        <header className="flex items-center gap-3.5">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-dark-300 shrink-0" />
          )}
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold tracking-[-0.035em] leading-tight truncate">
              {user?.displayName ?? 'Your account'}
            </h1>
            <p className="text-[13px] muted truncate">{user?.email}</p>
          </div>
        </header>

        <div className="rule mt-7" />
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <div className="flex items-baseline justify-between py-4 gap-4">
              <span className="text-[13.5px] muted shrink-0">{row.label}</span>
              <span className="text-[14px] font-semibold truncate">{row.value}</span>
            </div>
            <div className="rule" />
          </React.Fragment>
        ))}

        {role === 'customer' && (
          <>
            <button
              onClick={() => navigate('/wallet')}
              className="flex items-center justify-between py-4 w-full text-left"
            >
              <span className="text-[14px] font-semibold">Wallet &amp; transactions</span>
              <ChevronRight size={17} className="text-neutral-600" />
            </button>
            <div className="rule" />
          </>
        )}

        <p className="text-[12.5px] muted mt-7 leading-relaxed max-w-[38ch]">
          Each account holds one role. To use BeatBiddr the other way, delete this profile and sign
          up again.
        </p>

        <div className="mt-auto pt-10">
          <button onClick={handleLogout} className="btn-ghost w-full">
            Log out
          </button>
        </div>
      </div>
    </AppShell>
  );
};

export default ProfilePage;
