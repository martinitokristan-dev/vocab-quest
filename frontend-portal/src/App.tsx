import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MapsPage } from './pages/MapsPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { AudioReviewPage } from './pages/AudioReviewPage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomControlPage } from './pages/RoomControlPage';

// Layout wrapper — shows sidebar + main content for authenticated pages
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const activeTab = location.pathname.split('/')[1] || 'maps';

  return (
    <div className="min-h-screen bg-[#09090B] flex w-full">
      <Sidebar activeTab={activeTab} />
      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
};

// Guard — redirects unauthenticated users to /login
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Authenticating teacher session…</span>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Guard — redirects authenticated users away from login/register
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/maps" replace /> : <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Guest-only routes */}
    <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
    <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

    {/* Protected routes */}
    <Route path="/maps"       element={<ProtectedRoute><AppLayout><MapsPage /></AppLayout></ProtectedRoute>} />
    <Route path="/questions"  element={<ProtectedRoute><AppLayout><QuestionsPage /></AppLayout></ProtectedRoute>} />
    <Route path="/audio"      element={<ProtectedRoute><AppLayout><AudioReviewPage /></AppLayout></ProtectedRoute>} />
    <Route path="/rooms"      element={<ProtectedRoute><AppLayout><RoomsPage /></AppLayout></ProtectedRoute>} />
    <Route path="/rooms/:id"  element={<ProtectedRoute><AppLayout><RoomControlPage /></AppLayout></ProtectedRoute>} />

    {/* Default redirect */}
    <Route path="*" element={<Navigate to="/maps" replace />} />
  </Routes>
);

export const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;

