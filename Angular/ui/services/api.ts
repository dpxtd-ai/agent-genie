import { DocumentItem, ChunkItem, RagResponse, SystemHealth, BackendHealthDiagnostic, ServiceError } from '../types/rag';

let currentBackendUrl = ''; // Default relative /api or custom http://localhost:5000

export function setCustomBackendUrl(url: string) {
  currentBackendUrl = url.replace(/\/+$/, '');
}

export function getCustomBackendUrl(): string {
  return currentBackendUrl;
}

function resolveUrl(path: string): string {
  if (!currentBackendUrl) return path;
  return `${currentBackendUrl}${path.startsWith('/') ? path : '/' + path}`;
}

export function normalizeError(err: any): ServiceError {
  const errMsg = err?.message || String(err);

  // 1. .NET Backend API Server Connection Error
  if (
    errMsg.includes('Failed to fetch') ||
    errMsg.includes('NetworkError') ||
    errMsg.includes('ECONNREFUSED') ||
    errMsg.includes('Connection refused')
  ) {
    return {
      type: 'API_DISCONNECTED',
      title: 'Unable to connect to .NET Backend API Server',
      message: `The Angular client cannot connect to the .NET Web API at "${currentBackendUrl || window.location.origin + '/api'}".`,
      details: errMsg,
      remediation: 'Please start your .NET Web API backend using "dotnet run" in the /DotNet directory (default port: http://localhost:5000).'
    };
  }

  // 2. MS SQL Server Database Connection Error
  if (
    errMsg.includes('Unable to connect to MS SQL') ||
    errMsg.includes('ERR_DATABASE_UNAVAILABLE') ||
    errMsg.includes('SqlException') ||
    errMsg.includes('server was not found') ||
    errMsg.includes('DatabaseConnectionFailed')
  ) {
    return {
      type: 'DB_DISCONNECTED',
      title: 'Unable to connect to MS SQL Server Database',
      message: 'The .NET backend cannot establish a connection to your local/public MS SQL Server database.',
      details: errMsg,
      remediation: 'Check your MS SQL Server connection string in "/DotNet/appsettings.json" (Server=localhost,1433;Database=EnterpriseVectorDb...). Verify SQL Server is running and accept TCP/IP connections.'
    };
  }

  // 3. Gemini AI Connection Error
  if (
    errMsg.includes('Unable to connect to Google Gemini') ||
    errMsg.includes('ERR_GEMINI_UNAVAILABLE') ||
    errMsg.includes('GeminiConnectionFailed') ||
    errMsg.includes('API_KEY_INVALID') ||
    errMsg.includes('Gemini:ApiKey')
  ) {
    return {
      type: 'GEMINI_DISCONNECTED',
      title: 'Unable to connect to Google Gemini AI Service',
      message: 'The .NET backend cannot communicate with Google Gemini Embedding or LLM APIs.',
      details: errMsg,
      remediation: 'Set your valid Gemini API Key in "/DotNet/appsettings.json" under "Gemini:ApiKey" or export GEMINI_API_KEY environment variable.'
    };
  }

  return {
    type: 'UNKNOWN',
    title: 'Unexpected Application Error',
    message: errMsg,
    remediation: 'Check the browser network tab or the .NET terminal console logs for full stack traces.'
  };
}

export async function checkSystemDiagnostics(urlOverride?: string): Promise<BackendHealthDiagnostic> {
  const target = urlOverride !== undefined ? urlOverride : currentBackendUrl;
  const baseUrl = target || window.location.origin;

  const diagnostic: BackendHealthDiagnostic = {
    isChecking: false,
    apiConnected: false,
    dbConnected: false,
    geminiConnected: false,
    backendUrl: target || '/api (Integrated Proxy)',
  };

  try {
    const healthUrl = resolveUrl('/api/health');
    const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      diagnostic.apiConnected = false;
      diagnostic.apiErrorMessage = `HTTP ${res.status}: ${res.statusText}`;
      return diagnostic;
    }

    const data = await res.json();
    diagnostic.apiConnected = true;

    // Check DB status from health payload
    if (data.msSqlDatabase) {
      diagnostic.dbConnected = data.msSqlDatabase.status === 'Ready' || data.msSqlDatabase.status === 'Connected';
      if (!diagnostic.dbConnected) {
        diagnostic.dbErrorMessage = data.msSqlDatabase.message || 'Database unreachable';
      }
    } else {
      diagnostic.dbConnected = true;
    }

    // Check Gemini status from health payload
    if (data.geminiAi) {
      diagnostic.geminiConnected = data.geminiAi.status === 'Connected' || Boolean(data.geminiConfigured);
      if (!diagnostic.geminiConnected) {
        diagnostic.geminiErrorMessage = data.geminiAi.message || 'Gemini API key unconfigured';
      }
    } else {
      diagnostic.geminiConnected = Boolean(data.geminiConfigured);
    }
  } catch (err: any) {
    diagnostic.apiConnected = false;
    diagnostic.apiErrorMessage = err?.message || 'Connection refused or timeout';
  }

  return diagnostic;
}

export async function fetchHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(resolveUrl('/api/health'));
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Health check failed: HTTP ${res.status}`);
    }
    return res.json();
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  try {
    const res = await fetch(resolveUrl('/api/documents'));
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to fetch documents: HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.documents || [];
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function fetchDocumentChunks(id: string): Promise<ChunkItem[]> {
  try {
    const res = await fetch(resolveUrl(`/api/documents/${id}/chunks`));
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to fetch chunks');
    }
    const data = await res.json();
    return data.chunks || [];
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function uploadDocumentFile(
  file: File
): Promise<{ success: boolean; document: DocumentItem; chunksCreated: number }> {
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch(resolveUrl('/api/documents/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.name.split('.').pop() || 'txt',
            fileBase64: base64,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || `Upload failed with HTTP ${res.status}`);
        }

        const data = await res.json();
        resolve(data);
      } catch (err: any) {
        reject(normalizeError(err));
      }
    };
    reader.onerror = () => reject(normalizeError(new Error('Failed to read file from disk')));
    reader.readAsDataURL(file);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    const res = await fetch(resolveUrl(`/api/documents/${id}`), { method: 'DELETE' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to delete document');
    }
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function sendRagQuery(
  query: string,
  topK = 4,
  minSimilarity = 0.2,
  chatHistory: Array<{ role: 'user' | 'agent'; text: string }> = []
): Promise<RagResponse> {
  try {
    const res = await fetch(resolveUrl('/api/rag/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        topK,
        similarityThreshold: minSimilarity,
        chatHistory,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `RAG query failed with HTTP ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    throw normalizeError(err);
  }
}

export async function resetDatabaseSeed(): Promise<void> {
  const res = await fetch(resolveUrl('/api/database/seed'), { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset seed');
}
