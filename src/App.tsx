import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LevelsProvider } from './contexts/LevelsContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import LeadsPage from './pages/LeadsPage';
import EodPage from './pages/EodPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TasksPage from './pages/TasksPage';
import AdminPage from './pages/AdminPage';
import TvMode from './pages/TvMode';
import VerificationQueue from './pages/VerificationQueue';
import HRPage from './pages/HRPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-400 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          <div className="text-white/30 text-sm">Loading...</div>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!['admin', 'manager'].includes(profile.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function HRRoute({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!['admin', 'hr', 'manager'].includes(profile.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-400 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={session ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route path="/tv" element={<TvMode />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<LeadsPage />} />
                <Route path="/eod" element={<EodPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/verify" element={
                  <HRRoute>
                    <VerificationQueue />
                  </HRRoute>
                } />
                <Route path="/hr" element={
                  <HRRoute>
                    <HRPage />
                  </HRRoute>
                } />
                <Route path="/admin" element={
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                } />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LevelsProvider>
          <AppRoutes />
        </LevelsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
