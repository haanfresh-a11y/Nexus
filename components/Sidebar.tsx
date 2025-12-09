import React from 'react';
import { MessageSquare, Mic, Image as ImageIcon, Sparkles } from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const navItems = [
    { view: AppView.CHAT, icon: MessageSquare, label: 'Chat' },
    { view: AppView.LIVE, icon: Mic, label: 'Live' },
    { view: AppView.STUDIO, icon: ImageIcon, label: 'Studio' },
  ];

  return (
    <div className="w-20 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800/50">
        <div className="bg-gradient-to-br from-nexus-400 to-nexus-600 p-2 rounded-lg shrink-0">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-nexus-200 to-nexus-500 hidden md:block">
          Nexus
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onViewChange(item.view)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-nexus-500/10 text-nexus-400 shadow-sm shadow-nexus-500/10'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              <span className={`font-medium hidden md:block ${isActive ? 'text-nexus-300' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-nexus-400 shadow-[0_0_8px_rgba(56,189,248,0.6)] hidden md:block" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/50">
        <div className="text-xs text-slate-500 text-center md:text-left">
          <p className="hidden md:block">Powered by Gemini</p>
          <p className="md:hidden">v2.5</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;