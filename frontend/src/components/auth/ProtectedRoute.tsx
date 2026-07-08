import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'customer' | 'dj';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, role, djProfileComplete } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (role === null) return <Navigate to="/login" replace />;
  // DJs must finish onboarding before accessing any protected page
  if (role === 'dj' && !djProfileComplete) return <Navigate to="/dj-setup" replace />;
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'dj' ? '/dj' : '/customer'} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
