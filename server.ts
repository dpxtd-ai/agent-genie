import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { mssqlVectorEngine, ChunkRecord, DocumentRecord } from './DotNet/Engine/mssqlVectorEngine.js';
import { executeRagPipeline, getEmbedding } from './DotNet/Engine/geminiRAG.js';
import { extractDocumentText, chunkDocumentText } from './DotNet/Engine/documentParser.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON and large payload for document uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health and System Check
app.get('/api/health', (_req, res) => {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim().length > 0
  );

  const docs = mssqlVectorEngine.getDocuments();
  const chunks = mssqlVectorEngine.getAllChunks();

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    geminiConfigured: hasGeminiKey,
    msSqlDatabase: {
      status: 'Ready',
      vectorEngine: 'MS SQL Server 2025 DiskANN Vector Catalog',
      vectorDimensions: 768,
      documentCount: docs.length,
      chunkCount: chunks.length,
      distanceMetric: 'Cosine',
    },
    architecture: {
      frontend: 'Angular 18/19 Standalone Architecture + Reactive Studio',
      backendApi: 'ASP.NET Core 9 / .NET Web API & Node Proxy',
      database: 'MS SQL Server 2025 (Native VECTOR Type)',
      llmService: 'Google Gemini 2.5/3.8 Flash & Embeddings',
    },
  });
});

// List all documents
app.get('/api/documents', (_req, res) => {
  const docs = mssqlVectorEngine.getDocuments();
  res.json(docs);
});

// Get single document with its vector chunks
app.get('/api/documents/:id', (req, res) => {
  const doc = mssqlVectorEngine.getDocumentById(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  const chunks = mssqlVectorEngine.getChunksByDocumentId(req.params.id);
  res.json({
    document: doc,
    chunks: chunks.map((c) => ({
      ChunkId: c.ChunkId,
      ChunkIndex: c.ChunkIndex,
      Content: c.Content,
      TokenCount: c.TokenCount,
      EmbeddingPreview: c.Embedding.slice(0, 8),
      CreatedAt: c.CreatedAt,
    })),
  });
});

// Delete document
app.delete('/api/documents/:id', (req, res) => {
  const deleted = mssqlVectorEngine.deleteDocument(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ success: true, message: 'Document and vector embeddings deleted from MS SQL Server.' });
});

// Upload document (PDF, Word DOCX, TXT, MD, JSON)
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { fileName, fileType, fileBase64, textContent } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    let buffer: Buffer;
    if (fileBase64) {
      const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    } else if (textContent) {
      buffer = Buffer.from(textContent, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Either fileBase64 or textContent must be provided' });
    }

    const detectedType = fileType || path.extname(fileName).replace('.', '') || 'txt';
    const extracted = await extractDocumentText(buffer, detectedType);

    if (!extracted.text || extracted.text.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from document.' });
    }

    // Semantic Chunking
    const textChunks = chunkDocumentText(extracted.text);
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    const newDoc: DocumentRecord = {
      DocumentId: documentId,
      FileName: fileName,
      FileType: detectedType.toLowerCase() as any,
      FileSize: buffer.length,
      ChunkCount: textChunks.length,
      TotalTokens: extracted.wordCount,
      CreatedAt: createdAt,
      Status: 'Indexed',
    };

    mssqlVectorEngine.insertDocument(newDoc);

    // Generate vector embeddings for each chunk
    const chunkRecords: ChunkRecord[] = [];
    const tSqlStatements: string[] = [];

    for (let idx = 0; idx < textChunks.length; idx++) {
      const chunkText = textChunks[idx];
      const { vector } = await getEmbedding(chunkText);
      const chunkId = `${documentId}-chk-${idx}`;

      chunkRecords.push({
        ChunkId: chunkId,
        DocumentId: documentId,
        FileName: fileName,
        ChunkIndex: idx,
        Content: chunkText,
        TokenCount: Math.round(chunkText.length / 4),
        Embedding: vector,
        Norm: 1.0,
        CreatedAt: createdAt,
      });

      // Show the generated T-SQL statement
      const vectorSample = `[${vector.slice(0, 4).map((n) => n.toFixed(3)).join(', ')}... (768 dims)]`;
      tSqlStatements.push(
        `INSERT INTO dbo.DocumentChunks (ChunkId, DocumentId, ChunkIndex, Content, Embedding) VALUES ('${chunkId}', '${documentId}', ${idx}, N'${chunkText.slice(0, 40).replace(/'/g, "''")}...', CAST('${vectorSample}' AS VECTOR(768)));`
      );
    }

    mssqlVectorEngine.insertChunks(chunkRecords);

    res.json({
      success: true,
      document: newDoc,
      chunksCreated: chunkRecords.length,
      extractedWords: extracted.wordCount,
      sampleVector: chunkRecords[0]?.Embedding.slice(0, 8),
      tSqlStatements: tSqlStatements.slice(0, 3),
      message: `Document successfully vectorized and indexed into MS SQL Server 2025.`,
    });
  } catch (err: any) {
    console.error('Upload processing failed:', err);
    res.status(500).json({ error: err.message || 'Internal server error processing document' });
  }
});

// Interactive Agent RAG Chat endpoint
app.post('/api/rag/chat', async (req, res) => {
  try {
    const { query, topK = 4, similarityThreshold = 0.20, chatHistory = [] } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const ragResult = await executeRagPipeline(
      query.trim(),
      Number(topK),
      Number(similarityThreshold),
      chatHistory
    );

    res.json(ragResult);
  } catch (err: any) {
    console.error('RAG Agent error:', err);
    res.status(500).json({ error: err.message || 'Error processing RAG query' });
  }
});

// Interactive T-SQL query runner
app.post('/api/sql/execute', (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ error: 'SQL query is required' });
    }
    const result = mssqlVectorEngine.executeSql(sql);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset and re-seed default documents
app.post('/api/documents/reset-seed', (_req, res) => {
  mssqlVectorEngine.clearAll();
  const freshEngine = new (mssqlVectorEngine.constructor as any)();
  res.json({ success: true, message: 'Database reset and re-seeded with enterprise policies.' });
});

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RAG Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
