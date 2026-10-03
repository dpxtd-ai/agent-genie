import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ConnectionBanner } from './components/ConnectionBanner';
import { UploadFiles } from './components/UploadFiles';
import { AgentQA } from './components/AgentQA';
import { DocumentItem, SystemHealth, BackendHealthDiagnostic, ServiceError } from './types/rag';
import { fetchDocuments, fetchHealth, resetDatabaseSeed, checkSystemDiagnostics } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);

  const [diagnostic, setDiagnostic] = useState<BackendHealthDiagnostic>({
    isChecking: false,
    apiConnected: true,
    dbConnected: true,
    geminiConnected: true,
    backendUrl: '/api (Integrated Proxy)',
  });
  const [activeError, setActiveError] = useState<ServiceError | null>(null);

  const runDiagnostics = async () => {
    const diag = await checkSystemDiagnostics();
    setDiagnostic(diag);
  };

  const loadData = async () => {
    try {
      const [docs, h] = await Promise.all([fetchDocuments(), fetchHealth()]);
      setDocuments(docs);
      setHealth(h);
      const chunks = docs.reduce((acc, d) => acc + (d.ChunkCount || 0), 0);
      setTotalChunks(chunks);
      await runDiagnostics();
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      if (err.type) {
        setActiveError(err as ServiceError);
      }
      await runDiagnostics();
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleResetSeed = async () => {
    try {
      setIsResetting(true);
      await resetDatabaseSeed();
      await loadData();
    } catch (err: any) {
      console.error('Reset seed failed:', err);
      if (err.type) {
        setActiveError(err as ServiceError);
      }
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Global Header */}
      <Header
        health={health}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetSeed={handleResetSeed}
        isResetting={isResetting}
        totalDocs={documents.length}
        totalChunks={totalChunks}
      />

      {/* Main Content Area - strictly two tabs */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Real-time Diagnostic Alert Bar */}
        <ConnectionBanner
          diagnostic={diagnostic}
          onRefreshDiagnostic={runDiagnostics}
          activeError={activeError}
          onClearError={() => setActiveError(null)}
        />

        {activeTab === 'upload' && (
          <UploadFiles
            documents={documents}
            onRefreshDocs={loadData}
            onNavigateToAgent={() => setActiveTab('agent')}
            onErrorOccurred={(err) => setActiveError(err)}
          />
        )}

        {activeTab === 'agent' && (
          <AgentQA
            onNavigateToDocs={() => setActiveTab('upload')}
            documentCount={documents.length}
            onErrorOccurred={(err) => setActiveError(err)}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Enterprise Angular UI &amp; .NET 9 Web API Architecture</span>
          <span className="text-slate-400">MS SQL Server 2025 Vector Engine • Google Gemini AI RAG Pipeline</span>
        </div>
      </footer>
    </div>
  );
}
