import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Menu, Sparkles } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-slate-50">
      {/* Mobile Top App Bar (visible only on mobile screens < md) */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 cursor-pointer transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-xs text-slate-900">Vocab Quest</span>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          Teacher Portal
        </span>
      </header>

      <Sidebar activeTab={activeTab} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <main className="flex-1 h-full overflow-y-auto w-full bg-slate-50 p-4 sm:p-6 md:p-8 custom-scrollbar">
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
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
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;

