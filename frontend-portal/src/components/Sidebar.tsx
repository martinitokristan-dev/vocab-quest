import React from 'react';
import { Map, HelpCircle, Volume2, Monitor, LogOut, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'maps', label: 'Maps & Stages', icon: Map },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    { id: 'audio', label: 'Audio Feedback', icon: Volume2 },
    { id: 'rooms', label: 'Game Rooms', icon: Monitor },
  ];

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col justify-between p-3.5 h-screen h-full shrink-0 overflow-y-auto select-none shadow-xs custom-scrollbar">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-2.5 pt-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 tracking-tight">Vocab Quest</h1>
            <p className="text-[11px] text-slate-500 font-medium">Teacher Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/${item.id}`)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Logout */}
      <div className="pt-3 border-t border-slate-200 space-y-2">
        <div className="px-2.5 py-1">
          <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Teacher'}</p>
          <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
