import React, { useState, useEffect } from 'react';
import { Menu, X, Music, Wallet, LogIn, Search, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const onLoginPage = location.pathname === '/login';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => setIsOpen((prev) => !prev);

  const navLinks = [
    { name: 'Home', icon: <Music size={18} />, path: '/' },
    { name: 'Discover DJs', icon: <Search size={18} />, path: '/discover' },
    { name: 'Wallet', icon: <Wallet size={18} />, path: '/wallet' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-dark-600/80 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center">
            <span className="text-primary-500 mr-2">
              <Music size={28} />
            </span>
            <span className="font-bold text-xl text-white">
              Beat<span className="text-primary-500">Biddr</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center">
            <div className="flex items-center space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-dark-400 transition-all duration-200 flex items-center space-x-2 ${
                    location.pathname === link.path ? 'bg-dark-400 text-white' : ''
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.name}</span>
                </Link>
              ))}

              {/* Auth action: Profile when signed in, Login when signed out (hidden on /login) */}
              {!onLoginPage &&
                (user ? (
                  <button
                    onClick={() => navigate('/customer')}
                    className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-dark-400 transition-all duration-200 flex items-center space-x-2"
                  >
                    <UserIcon size={18} />
                    <span>Profile</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-dark-400 transition-all duration-200 flex items-center space-x-2"
                  >
                    <LogIn size={18} />
                    <span>Login</span>
                  </Link>
                ))}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              type="button"
              className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              aria-expanded={isOpen}
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-dark-500 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-dark-400 w-full text-left transition-all duration-200 flex items-center space-x-3 ${
                    location.pathname === link.path ? 'bg-dark-400 text-white' : ''
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <span>{link.icon}</span>
                  <span>{link.name}</span>
                </Link>
              ))}

              {/* Auth action in mobile menu */}
              {!onLoginPage &&
                (user ? (
                  <button
                    onClick={() => {
                      navigate('/customer');
                      setIsOpen(false);
                    }}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-dark-400 w-full text-left transition-all duration-200 flex items-center space-x-3"
                  >
                    <UserIcon size={18} />
                    <span>Profile</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-dark-400 w-full text-left transition-all duration-200 flex items-center space-x-3"
                    onClick={() => setIsOpen(false)}
                  >
                    <LogIn size={18} />
                    <span>Login</span>
                  </Link>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
