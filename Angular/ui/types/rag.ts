export interface DocumentItem {
  DocumentId: string;
  FileName: string;
  FileType: 'pdf' | 'docx' | 'txt' | 'md' | 'json';
  FileSize: number;
  ChunkCount: number;
  TotalTokens: number;
  CreatedAt: string;
  Status: 'Indexed' | 'Processing' | 'Failed';
}

export interface ChunkItem {
  ChunkId: string;
  DocumentId: string;
  FileName: string;
  ChunkIndex: number;
  Content: string;
  TokenCount: number;
  Embedding: number[];
  Norm?: number;
  CreatedAt: string;
}

export interface SearchResultChunk {
  ChunkId: string;
  DocumentId: string;
  FileName: string;
  ChunkIndex: number;
  Content: string;
  Distance: number;
  SimilarityScore: number;
}

export interface RagResponse {
  answer: string;
  clarificationQuestion?: string;
  hasClarification: boolean;
  retrievedChunks: SearchResultChunk[];
  sqlExecutionQuery: string;
  totalChunksScanned: number;
  searchTimeMs: number;
  llmTimeMs: number;
  modelUsed: string;
  confidenceScore: number;
  queryVectorSample: number[];
}

export interface BackendHealthDiagnostic {
  isChecking: boolean;
  apiConnected: boolean;
  apiErrorMessage?: string;
  dbConnected: boolean;
  dbErrorMessage?: string;
  geminiConnected: boolean;
  geminiErrorMessage?: string;
  backendUrl: string;
}

export interface ServiceError {
  type: 'API_DISCONNECTED' | 'DB_DISCONNECTED' | 'GEMINI_DISCONNECTED' | 'UNKNOWN';
  title: string;
  message: string;
  details?: string;
  remediation: string;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  geminiConfigured: boolean;
  msSqlDatabase: {
    status: string;
    vectorEngine: string;
    vectorDimensions: number;
    documentCount: number;
    chunkCount: number;
    distanceMetric: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
  clarification?: string;
  retrievedChunks?: SearchResultChunk[];
  sqlExecutionQuery?: string;
  searchTimeMs?: number;
  llmTimeMs?: number;
  modelUsed?: string;
  confidenceScore?: number;
}
