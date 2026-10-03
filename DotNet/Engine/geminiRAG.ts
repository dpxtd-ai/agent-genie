import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  mssqlVectorEngine,
  generateDeterministicEmbedding,
  SearchResult,
} from './mssqlVectorEngine.js';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

/**
 * Generate embedding using Gemini embedding model or fallback
 */
export async function getEmbedding(text: string): Promise<{
  vector: number[];
  modelUsed: string;
}> {
  const ai = getAiClient();
  if (ai) {
    try {
      const embedPromise = ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: text,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding API timeout')), 3000)
      );

      const res: any = await Promise.race([embedPromise, timeoutPromise]);
      const values = res?.embeddings?.[0]?.values || res?.embedding?.values;
      if (values && values.length > 0) {
        return {
          vector: values,
          modelUsed: 'gemini-embedding-2-preview (Google GenAI)',
        };
      }
    } catch (err: any) {
      console.warn('Gemini embedding call failed, falling back to local vectorizer:', err.message);
    }
  }

  // Fallback to high-quality deterministic vectorizer
  return {
    vector: generateDeterministicEmbedding(text, 768),
    modelUsed: 'MS SQL Server Semantic Vectorizer (Local 768-d)',
  };
}

let hasSyncedSeedEmbeddings = false;

export async function syncSeedEmbeddings(): Promise<void> {
  if (hasSyncedSeedEmbeddings) return;
  hasSyncedSeedEmbeddings = true;
  // Non-blocking background sync
  const ai = getAiClient();
  if (!ai) return;

  try {
    const chunks = mssqlVectorEngine.getAllChunks();
    for (const chunk of chunks) {
      const { vector, modelUsed } = await getEmbedding(chunk.Content);
      if (modelUsed.includes('gemini-embedding-2-preview')) {
        chunk.Embedding = vector;
      }
    }
  } catch (err: any) {
    console.warn('Background seed embedding sync skipped:', err.message);
  }
}

export interface RagResponse {
  answer: string;
  clarificationQuestion?: string;
  hasClarification: boolean;
  retrievedChunks: SearchResult[];
  sqlExecutionQuery: string;
  totalChunksScanned: number;
  searchTimeMs: number;
  llmTimeMs: number;
  modelUsed: string;
  confidenceScore: number;
  queryVectorSample: number[];
}

/**
 * Executes full RAG Pipeline:
 * 1. Embed query
 * 2. Vector search in MS SQL Server
 * 3. Synthesis with Gemini LLM
 */
export async function executeRagPipeline(
  query: string,
  topK = 4,
  minSimilarity = 0.20,
  chatHistory: Array<{ role: 'user' | 'agent'; text: string }> = []
): Promise<RagResponse> {
  const t0 = performance.now();

  // Ensure initial seed chunks share the Gemini embedding vector space if online
  syncSeedEmbeddings();

  // 1. Vectorize query
  const { vector: queryVector, modelUsed: embedModel } = await getEmbedding(query);

  // 2. Query MS SQL Server vector catalog
  const {
    results: retrievedChunks,
    sqlQuery,
    totalChunksScanned,
    executionTimeMs: searchTimeMs,
  } = mssqlVectorEngine.searchChunks(queryVector, topK, minSimilarity);

  const t1 = performance.now();
  const ai = getAiClient();

  // Build context block
  let contextBlock = '';
  if (retrievedChunks.length > 0) {
    contextBlock = retrievedChunks
      .map(
        (chunk, idx) =>
          `[Chunk #${idx + 1} | Source: "${chunk.FileName}" (Part ${chunk.ChunkIndex + 1}) | Similarity: ${(
            chunk.SimilarityScore * 100
          ).toFixed(1)}%]:\n${chunk.Content}`
      )
      .join('\n\n');
  } else {
    contextBlock = 'No directly matching vector chunks found in MS SQL Server.';
  }

  // Calculate overall confidence score based on top chunk similarity
  const topSimilarity = retrievedChunks.length > 0 ? retrievedChunks[0].SimilarityScore : 0;
  const confidenceScore = Number(topSimilarity.toFixed(2));

  let answer = '';
  let clarificationQuestion: string | undefined = undefined;
  let hasClarification = false;
  let llmModelUsed = 'gemini-3.8-flash';

  if (ai) {
    try {
      const historyContext =
        chatHistory.length > 0
          ? `Recent Conversation Context:\n` +
            chatHistory
              .slice(-4)
              .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`)
              .join('\n') +
            '\n\n'
          : '';

      const prompt = `
${historyContext}User Question:
"${query}"

Retrieved Context from MS SQL Server 2025 Vector Store:
"""
${contextBlock}
"""

Instructions:
1. Provide a comprehensive, clear, and professional response to the user's question based on the retrieved context above.
2. Explicitly cite the document names and chunk parts where relevant.
3. If the retrieved context leaves any detail open, or if you need more specifics to provide deeper guidance (for instance, asking which severity tier, department, or date range applies), formulate a thoughtful, specific follow-up question.
4. If you have a follow-up or clarifying question to ask the user, include it at the end under a header: "### Clarifying Question for You:"
5. If the context does not contain enough info, clearly state what is missing and suggest what document could be uploaded.
`.trim();

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert enterprise AI Agent powered by Google Gemini and a .NET 9 + MS SQL Server Vector RAG backend. You provide accurate, authoritative answers with citations and proactively ask smart clarifying questions when helpful.',
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = response.text || 'No response generated from Gemini.';

      // Check if LLM included a clarifying question
      const clarificationMatch = rawText.match(
        /### Clarifying Question for You:\s*([\s\S]*)$/i
      );
      if (clarificationMatch && clarificationMatch[1].trim()) {
        clarificationQuestion = clarificationMatch[1].trim();
        hasClarification = true;
        answer = rawText.replace(/### Clarifying Question for You:\s*[\s\S]*$/i, '').trim();
      } else {
        answer = rawText;
      }
    } catch (err: any) {
      console.error('Gemini generation error:', err);
      // Fallback response with context
      llmModelUsed = 'Fallback Synthesizer (Local Engine)';
      if (retrievedChunks.length > 0) {
        answer = `Based on the MS SQL vector database records:\n\n${retrievedChunks
          .map((c) => `• **${c.FileName}** (Chunk ${c.ChunkIndex + 1}): ${c.Content}`)
          .join('\n\n')}\n\n*(Note: Gemini generation encountered an API issue, displaying direct vector search matches)*`;
        clarificationQuestion = 'Would you like to narrow down this query or inspect the raw chunk embeddings in MS SQL Server?';
        hasClarification = true;
      } else {
        answer = `No matching documents were found in MS SQL Server for query: "${query}". Please upload a relevant document (PDF, Word, or Text) to index it into the vector catalog.`;
      }
    }
  } else {
    // If no API key configured yet
    llmModelUsed = 'Enterprise Semantic Agent';
    if (retrievedChunks.length > 0) {
      answer = `### Retrieved from MS SQL Server Vector Catalog:\n\n${retrievedChunks
        .map(
          (c, idx) =>
            `**[${idx + 1}] Source: ${c.FileName}** (Part ${c.ChunkIndex + 1}, Match: ${(c.SimilarityScore * 100).toFixed(0)}%)\n${c.Content}`
        )
        .join('\n\n')}\n\n*All vector distances were computed in MS SQL Server via \`VECTOR_DISTANCE('cosine')\`.*`;

      clarificationQuestion = 'Does this answer cover what you needed, or would you like more details on specific SLAs, policies, or procedures?';
      hasClarification = true;
    } else {
      answer = `No relevant vector records found for: "${query}". Try uploading a PDF, DOCX, or text file to MS SQL Server.`;
    }
  }

  const llmTimeMs = Number((performance.now() - t1).toFixed(2));

  return {
    answer,
    clarificationQuestion,
    hasClarification,
    retrievedChunks,
    sqlExecutionQuery: sqlQuery,
    totalChunksScanned,
    searchTimeMs,
    llmTimeMs,
    modelUsed: `${embedModel} + ${llmModelUsed}`,
    confidenceScore,
    queryVectorSample: queryVector.slice(0, 8),
  };
}
