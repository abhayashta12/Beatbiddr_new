import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import UpdateBanner from './components/layout/UpdateBanner';

// Each route is its own chunk, so opening /login no longer downloads the
// Stripe wallet, the DJ dashboard, or the landing page's 3D scene.
const Home = lazy(() => import('./pages/Home'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const DJDashboardPage = lazy(() => import('./pages/DJDashboardPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const DiscoverDJsPage = lazy(() => import('./pages/DiscoverDJsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DJOnboardingPage = lazy(() => import('./pages/DJOnboardingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

const RouteFallback = () => (
  <div className="min-h-screen bg-dark-600 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

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
    <Suspense fallback={<RouteFallback />}>
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
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      {/* Public — people should be able to read the terms before signing up */}
      <Route path="/legal/:doc" element={<LegalPage />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        {/* Sits outside the routes so it survives navigation */}
        <UpdateBanner />
      </Router>
    </AuthProvider>
  );
}

export default App;
