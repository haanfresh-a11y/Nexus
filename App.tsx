import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './views/ChatView';
import LiveView from './views/LiveView';
import StudioView from './views/StudioView';
import { AppView } from './types';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);

  const renderView = () => {
    switch (currentView) {
      case AppView.CHAT:
        return <ChatView />;
      case AppView.LIVE:
        return <LiveView />;
      case AppView.STUDIO:
        return <StudioView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 font-sans selection:bg-nexus-500/30">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 relative overflow-hidden">
        {renderView()}
      </main>
    </div>
  );
}