import React from 'react';
import { Map, HelpCircle, Volume2, Users, LogOut, Terminal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'maps', label: 'Map Sequence', icon: Map },
    { id: 'questions', label: 'Questions & Content', icon: HelpCircle },
    { id: 'audio', label: 'Audio Review', icon: Volume2 },
    { id: 'rooms', label: 'Game Rooms', icon: Users },
  ];

  return (
    <aside className="w-60 bg-[#121215] border-r border-white/5 flex flex-col justify-between p-4 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-2 py-3 mb-6 border-b border-white/5">
          <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-zinc-100 leading-tight">EPCES Vocab</h1>
            <p className="text-[11px] text-zinc-500 font-normal">Teacher Console</p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-zinc-800/90 text-zinc-100 font-semibold border-l-2 border-emerald-500 pl-2.5'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Logout */}
      <div className="pt-3 border-t border-white/5">
        <div className="px-2 py-1.5 mb-2">
          <p className="text-xs font-medium text-zinc-200 truncate">{user?.name || 'Teacher'}</p>
          <p className="text-[11px] text-zinc-500 truncate">{user?.email}</p>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
