import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Wallet, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Bottom navigation. Phones are held one-handed, so the destinations live in
 * the thumb zone rather than behind a hamburger at the top of the screen.
 * The safe-area padding keeps taps off the home indicator and clear of
 * Safari's own toolbar.
 */
const TabBar: React.FC = () => {
  const { role } = useAuth();
  const isDJ = role === 'dj';

  const tabs = isDJ
    ? [
        { to: '/dj', label: 'Queue', Icon: Home },
        { to: '/discover', label: 'Discover', Icon: Search },
        { to: '/profile', label: 'You', Icon: User },
      ]
    : [
        { to: '/customer', label: 'Tonight', Icon: Home },
        { to: '/discover', label: 'Discover', Icon: Search },
        { to: '/wallet', label: 'Wallet', Icon: Wallet },
        { to: '/profile', label: 'You', Icon: User },
      ];

  return (
    <nav className="shrink-0 border-t border-white/[0.07] bg-dark-600 safe-bottom">
      <div className="flex px-2 pt-2 pb-1.5">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${
                isActive ? 'text-white' : 'text-neutral-600 hover:text-neutral-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                <span className="text-[10.5px] font-semibold tracking-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default TabBar;
