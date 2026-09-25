import React from 'react';
import { Volume2, Sparkles, History, HelpCircle } from 'lucide-react';

interface HeaderProps {
  activeTab: 'converter' | 'voices' | 'history' | 'about';
  setActiveTab: (tab: 'converter' | 'voices' | 'history' | 'about') => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, historyCount }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Single text element brand wordmark */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-100">
            <Volume2 className="h-5 w-5 text-neutral-200" />
          </div>
          <button
            onClick={() => setActiveTab('converter')}
            className="text-lg font-semibold tracking-tight text-white hover:text-neutral-200 transition-colors"
          >
            VozLivre
          </button>
        </div>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
          <button
            onClick={() => setActiveTab('converter')}
            className={`transition-colors pb-1 ${
              activeTab === 'converter'
                ? 'text-white border-b-2 border-white font-semibold'
                : 'hover:text-neutral-200'
            }`}
          >
            Conversor
          </button>
          <button
            onClick={() => setActiveTab('voices')}
            className={`transition-colors pb-1 ${
              activeTab === 'voices'
                ? 'text-white border-b-2 border-white font-semibold'
                : 'hover:text-neutral-200'
            }`}
          >
            Vozes Neurais
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`transition-colors pb-1 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-white border-b-2 border-white font-semibold'
                : 'hover:text-neutral-200'
            }`}
          >
            <span>Histórico</span>
            {historyCount > 0 && (
              <span className="font-mono text-xs text-neutral-400">({historyCount})</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`transition-colors pb-1 ${
              activeTab === 'about'
                ? 'text-white border-b-2 border-white font-semibold'
                : 'hover:text-neutral-200'
            }`}
          >
            Como Funciona
          </button>
        </nav>

        {/* Zone 3: Primary indicator and action */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Uso Ilimitado</span>
            <span aria-hidden="true">·</span>
            <span>Zero Créditos</span>
          </div>

          <div className="md:hidden flex items-center gap-1">
            <button
              onClick={() => setActiveTab('converter')}
              className={`p-2 rounded-lg text-sm ${activeTab === 'converter' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title="Conversor"
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`p-2 rounded-lg text-sm ${activeTab === 'history' ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
              title="Histórico"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
