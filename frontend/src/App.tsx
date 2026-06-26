import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import CustomerDashboard from './pages/CustomerDashboard';
import DJDashboardPage from './pages/DJDashboardPage';
import WalletPage from './pages/WalletPage';
import DiscoverDJsPage from './pages/DiscoverDJsPage';
import LoginPage from './pages/LoginPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

function AppRoutes() {
  const { user, role } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={
          user
            ? role === null
              ? <Navigate to="/select-role" replace />
              : <Navigate to={role === 'dj' ? '/dj' : '/customer'} replace />
            : <LoginPage />
        }
      />
      <Route
        path="/select-role"
        element={
          user ? <RoleSelectionPage /> : <Navigate to="/login" replace />
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
