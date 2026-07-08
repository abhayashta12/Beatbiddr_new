import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import CustomerDashboard from './pages/CustomerDashboard';
import DJDashboardPage from './pages/DJDashboardPage';
import WalletPage from './pages/WalletPage';
import DiscoverDJsPage from './pages/DiscoverDJsPage';
import LoginPage from './pages/LoginPage';
import DJOnboardingPage from './pages/DJOnboardingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

function AppRoutes() {
  const { user, role, djProfileComplete } = useAuth();

  // Redirect logged-in users away from /login to their dashboard.
  // New DJs go to onboarding until their profile is complete.
  const loginRedirect = user
    ? role === 'dj'
      ? <Navigate to={djProfileComplete ? '/dj' : '/dj-setup'} replace />
      : role === 'customer'
      ? <Navigate to="/customer" replace />
      : <LoginPage />
    : <LoginPage />;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={loginRedirect} />
      <Route
        path="/dj-setup"
        element={
          !user || role !== 'dj'
            ? <Navigate to="/login" replace />
            : djProfileComplete
            ? <Navigate to="/dj" replace />
            : <DJOnboardingPage />
        }
      />
      <Route
        path="/customer"
        element={
          <ProtectedRoute requiredRole="customer">
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dj"
        element={
          <ProtectedRoute requiredRole="dj">
            <DJDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute requiredRole="customer">
            <WalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <DiscoverDJsPage />
          </ProtectedRoute>
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
