import React, { useState } from 'react';
import {
  Server,
  Database,
  Bot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BackendHealthDiagnostic, ServiceError } from '../types/rag';
import { setCustomBackendUrl, getCustomBackendUrl, checkSystemDiagnostics } from '../services/api';

interface ConnectionBannerProps {
  diagnostic: BackendHealthDiagnostic;
  onRefreshDiagnostic: () => void;
  activeError: ServiceError | null;
  onClearError: () => void;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({
  diagnostic,
  onRefreshDiagnostic,
  activeError,
  onClearError,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(getCustomBackendUrl());
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleApplyUrl = async () => {
    setIsTesting(true);
    setTestResult(null);
    setCustomBackendUrl(customUrl);

    try {
      const diag = await checkSystemDiagnostics(customUrl);
      if (diag.apiConnected) {
        setTestResult('✓ Successfully connected to .NET Web API!');
      } else {
        setTestResult(`❌ Connection Failed: ${diag.apiErrorMessage || 'Cannot reach server'}`);
      }
      onRefreshDiagnostic();
    } catch (err: any) {
      setTestResult(`❌ Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-3 mb-6">
      {/* Active Service Error Alert Box */}
      {activeError && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 shadow-sm flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-rose-900 flex items-center gap-2">
                <span>{activeError.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-200 text-rose-800 uppercase font-semibold">
                  {activeError.type}
                </span>
              </h4>
              <p className="text-xs text-rose-800 leading-relaxed font-medium">
                {activeError.message}
              </p>
              {activeError.details && (
                <div className="text-[11px] font-mono bg-white/70 p-2 rounded-lg border border-rose-200 text-rose-700 break-all">
                  {activeError.details}
                </div>
              )}
              <div className="mt-2 text-xs text-rose-900 bg-rose-100/70 p-2.5 rounded-lg border border-rose-200/80">
                <span className="font-bold">Suggested Remediation:</span> {activeError.remediation}
              </div>
            </div>
          </div>
          <button
            onClick={onClearError}
            className="text-xs font-semibold px-2 py-1 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-900 transition cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tri-Service Health Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
          <span className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
            Architecture Services:
          </span>

          {/* 1. .NET Backend API */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium ${
              diagnostic.apiConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>.NET Backend API:</span>
            {diagnostic.apiConnected ? (
              <span className="font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Online
              </span>
            ) : (
              <span className="font-bold flex items-center gap-1 text-rose-700">
                <XCircle className="w-3 h-3 text-rose-600" /> Disconnected
              </span>
            )}
          </div>

          {/* 2. MS SQL Server Database */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium ${
              diagnostic.dbConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>MS SQL Server:</span>
            {diagnostic.dbConnected ? (
              <span className="font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Connected
              </span>
            ) : (
              <span className="font-bold flex items-center gap-1 text-amber-700">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> Check Config
              </span>
            )}
          </div>

          {/* 3. Google Gemini AI */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-medium ${
              diagnostic.geminiConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Gemini AI:</span>
            {diagnostic.geminiConnected ? (
              <span className="font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ready
              </span>
            ) : (
              <span className="font-bold flex items-center gap-1 text-amber-700">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> Local Fallback
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshDiagnostic}
            title="Recheck services connection"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Test Connectivity</span>
          </button>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>API URL Config</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded API Target Configuration Drawer */}
      {showConfig && (
        <div className="p-4 bg-slate-900 rounded-2xl text-slate-100 text-xs border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h5 className="font-bold text-white text-xs">
                Independent .NET Web API Endpoint Configuration
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When deploying Angular alone (e.g. Nginx, S3, Vercel) and .NET alone on another server, specify the .NET API URL below.
              </p>
            </div>
            <span className="font-mono text-[10px] text-indigo-300 bg-slate-800 px-2 py-1 rounded">
              Current: {customUrl || 'Relative /api'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="e.g. http://localhost:5000 or https://your-dotnet-api.com"
              className="flex-1 w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={handleApplyUrl}
                disabled={isTesting}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isTesting ? 'Testing...' : 'Save & Test'}
              </button>
              <button
                onClick={() => {
                  setCustomUrl('');
                  setCustomBackendUrl('');
                  onRefreshDiagnostic();
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
              >
                Reset Default
              </button>
            </div>
          </div>

          {testResult && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px]">
              {testResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
