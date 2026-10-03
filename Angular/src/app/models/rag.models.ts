export interface DocumentRecord {
  documentId: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'md' | 'json';
  fileSize: number;
  chunkCount: number;
  totalTokens: number;
  createdAt: string;
  status: string;
}

export interface SearchResultChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  distance: number;
  similarityScore: number;
}

export interface RagChatRequest {
  query: string;
  topK?: number;
  similarityThreshold?: number;
  chatHistory?: Array<{ role: 'user' | 'agent'; text: string }>;
}

export interface RagChatResponse {
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: string;
  clarification?: string;
  retrievedChunks?: SearchResultChunk[];
  sqlExecutionQuery?: string;
}
