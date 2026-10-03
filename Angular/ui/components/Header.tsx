import React from 'react';
import { FileText, Cpu, Database, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { SystemHealth } from '../types/rag';

interface HeaderProps {
  health: SystemHealth | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onResetSeed: () => void;
  isResetting: boolean;
  totalDocs: number;
  totalChunks: number;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  activeTab,
  setActiveTab,
  onResetSeed,
  isResetting,
  totalDocs,
  totalChunks,
}) => {
  const tabs = [
    { id: 'upload', label: 'Upload Files', icon: FileText },
    { id: 'agent', label: 'Agent Q&A (Vector + Gemini)', icon: Cpu },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 via-indigo-600 to-sky-500 p-0.5 shadow-lg flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-indigo-300 text-lg">
                🅰
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Enterprise Angular UI &amp; .NET MS SQL RAG
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                MS SQL Server 2025 Vector
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Angular Frontend connected to ASP.NET Core 9 &amp; Gemini AI RAG Pipeline
            </p>
          </div>
        </div>

        {/* Server Status & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-300 font-medium">MS SQL Server:</span>
            <span className="font-mono text-indigo-300 font-semibold">{totalDocs} Docs</span>
            <span className="text-slate-500">|</span>
            <span className="font-mono text-emerald-400 font-semibold">{totalChunks} Chunks (768-d)</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
            {health?.geminiConfigured ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">Gemini AI Active</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">Local Vectorizer</span>
              </>
            )}
          </div>

          <button
            onClick={onResetSeed}
            disabled={isResetting}
            title="Reload default sample documents into MS SQL Server"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset Seed</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs - STRICTLY 2 TABS */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex space-x-1 border-t border-slate-800/80 pt-1 pb-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
