import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MapsPage } from './pages/MapsPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { AudioReviewPage } from './pages/AudioReviewPage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomControlPage } from './pages/RoomControlPage';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [activeTab, setActiveTab] = useState<string>('maps');
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

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

  if (!user) {
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex w-full">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab);
        setSelectedRoomId(null);
      }} />

      {/* Main Content Viewport — Full width responsive container */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
        {selectedRoomId ? (
          <RoomControlPage
            roomId={selectedRoomId}
            onBack={() => setSelectedRoomId(null)}
          />
        ) : activeTab === 'maps' ? (
          <MapsPage />
        ) : activeTab === 'questions' ? (
          <QuestionsPage />
        ) : activeTab === 'audio' ? (
          <AudioReviewPage />
        ) : (
          <RoomsPage onSelectRoom={(id) => setSelectedRoomId(id)} />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
