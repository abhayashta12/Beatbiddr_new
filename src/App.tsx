import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CustomerDashboard from './pages/CustomerDashboard';
import DJDashboardPage from './pages/DJDashboardPage';
import WalletPage from './pages/WalletPage';
import DiscoverDJsPage from './pages/DiscoverDJsPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/customer" element={<CustomerDashboard />} />
          <Route path="/dj" element={<DJDashboardPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/discover" element={<DiscoverDJsPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;