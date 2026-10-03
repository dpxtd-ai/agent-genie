/**
 * MS SQL Server 2025 In-Memory Vector Engine
 * Implements native MS SQL Vector data types, Cosine distance calculation,
 * and T-SQL statement simulation.
 */

export interface DocumentRecord {
  DocumentId: string;
  FileName: string;
  FileType: 'pdf' | 'docx' | 'txt' | 'md' | 'json';
  FileSize: number;
  ChunkCount: number;
  TotalTokens: number;
  CreatedAt: string;
  Status: 'Indexed' | 'Processing' | 'Failed';
}

export interface ChunkRecord {
  ChunkId: string;
  DocumentId: string;
  FileName: string;
  ChunkIndex: number;
  Content: string;
  TokenCount: number;
  Embedding: number[]; // 768-dimension vector
  Norm: number;
  CreatedAt: string;
}

export interface SearchResult {
  ChunkId: string;
  DocumentId: string;
  FileName: string;
  ChunkIndex: number;
  Content: string;
  Distance: number; // 0 (identical) to 2 (opposite)
  SimilarityScore: number; // 0.0 to 1.0 (1 - distance/2 or cosine similarity)
}

export class MsSqlVectorEngine {
  private documents: Map<string, DocumentRecord> = new Map();
  private chunks: Map<string, ChunkRecord> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  public getDocuments(): DocumentRecord[] {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
    );
  }

  public getDocumentById(id: string): DocumentRecord | undefined {
    return this.documents.get(id);
  }

  public getChunksByDocumentId(documentId: string): ChunkRecord[] {
    return Array.from(this.chunks.values())
      .filter((c) => c.DocumentId === documentId)
      .sort((a, b) => a.ChunkIndex - b.ChunkIndex);
  }

  public getAllChunks(): ChunkRecord[] {
    return Array.from(this.chunks.values());
  }

  public insertDocument(doc: DocumentRecord): void {
    this.documents.set(doc.DocumentId, doc);
  }

  public insertChunks(newChunks: ChunkRecord[]): void {
    for (const chunk of newChunks) {
      this.chunks.set(chunk.ChunkId, chunk);
    }
  }

  public deleteDocument(documentId: string): boolean {
    const existed = this.documents.delete(documentId);
    if (existed) {
      for (const [chunkId, chunk] of this.chunks.entries()) {
        if (chunk.DocumentId === documentId) {
          this.chunks.delete(chunkId);
        }
      }
    }
    return existed;
  }

  public clearAll(): void {
    this.documents.clear();
    this.chunks.clear();
  }

  /**
   * MS SQL Server 2025 VECTOR_DISTANCE('cosine', v1, v2) implementation
   */
  public vectorDistanceCosine(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) {
      const len = Math.min(v1.length, v2.length);
      v1 = v1.slice(0, len);
      v2 = v2.slice(0, len);
    }

    let dot = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 1.0;

    const cosineSim = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
    // Cosine distance in MS SQL Server is 1 - CosineSimilarity
    const distance = Math.max(0, Math.min(2, 1 - cosineSim));
    return distance;
  }

  /**
   * Performs Vector Similarity Search simulating MS SQL Server 2025
   */
  public searchChunks(
    queryEmbedding: number[],
    topK = 5,
    minSimilarity = 0.25
  ): {
    results: SearchResult[];
    sqlQuery: string;
    totalChunksScanned: number;
    executionTimeMs: number;
  } {
    const startTime = performance.now();
    const scoredChunks: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      const distance = this.vectorDistanceCosine(chunk.Embedding, queryEmbedding);
      // Similarity score between 0 and 1
      const similarityScore = Math.max(0, 1 - distance);

      if (similarityScore >= minSimilarity) {
        scoredChunks.push({
          ChunkId: chunk.ChunkId,
          DocumentId: chunk.DocumentId,
          FileName: chunk.FileName,
          ChunkIndex: chunk.ChunkIndex,
          Content: chunk.Content,
          Distance: Number(distance.toFixed(4)),
          SimilarityScore: Number(similarityScore.toFixed(4)),
        });
      }
    }

    // Sort ascending by Distance (closest vectors first)
    scoredChunks.sort((a, b) => a.Distance - b.Distance);
    const results = scoredChunks.slice(0, topK);
    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    // Formatted MS SQL T-SQL query that represents the equivalent query
    const vectorPreview = `[${queryEmbedding.slice(0, 4).map((n) => n.toFixed(3)).join(', ')}... (768 dims)]`;
    const sqlQuery = `
-- MS SQL Server 2025 Vector Search Execution
DECLARE @QueryVector VECTOR(768) = '${vectorPreview}';
DECLARE @TopK INT = ${topK};
DECLARE @MinSimilarity FLOAT = ${minSimilarity};

SELECT TOP (@TopK)
    c.ChunkId,
    d.FileName,
    c.ChunkIndex,
    c.Content,
    VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector) AS VectorDistance,
    (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector)) AS SimilarityScore
FROM dbo.DocumentChunks c WITH (INDEX(IX_DocumentChunks_Embedding_DiskANN))
INNER JOIN dbo.Documents d ON c.DocumentId = d.DocumentId
WHERE (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector)) >= @MinSimilarity
ORDER BY VectorDistance ASC;
    `.trim();

    return {
      results,
      sqlQuery,
      totalChunksScanned: this.chunks.size,
      executionTimeMs,
    };
  }

  /**
   * Execute raw mock T-SQL commands for interactive exploration
   */
  public executeSql(query: string): {
    columns: string[];
    rows: any[];
    rowCount: number;
    message: string;
    executionTimeMs: number;
  } {
    const startTime = performance.now();
    const cleanQuery = query.trim().toUpperCase();

    if (cleanQuery.includes('FROM DOCUMENTS') || cleanQuery.includes('FROM DBO.DOCUMENTS')) {
      const docs = this.getDocuments();
      return {
        columns: ['DocumentId', 'FileName', 'FileType', 'FileSize', 'ChunkCount', 'TotalTokens', 'CreatedAt', 'Status'],
        rows: docs,
        rowCount: docs.length,
        message: `Command(s) completed successfully. (${docs.length} row(s) affected)`,
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    if (cleanQuery.includes('FROM DOCUMENTCHUNKS') || cleanQuery.includes('FROM DBO.DOCUMENTCHUNKS')) {
      const chunks = Array.from(this.chunks.values()).slice(0, 10).map((c) => ({
        ChunkId: c.ChunkId,
        DocumentId: c.DocumentId,
        FileName: c.FileName,
        ChunkIndex: c.ChunkIndex,
        TokenCount: c.TokenCount,
        Content: c.Content.substring(0, 80) + '...',
        EmbeddingSample: `VECTOR(768) [${c.Embedding.slice(0, 3).map((v) => v.toFixed(3)).join(', ')}...]`,
      }));
      return {
        columns: ['ChunkId', 'DocumentId', 'FileName', 'ChunkIndex', 'TokenCount', 'Content', 'EmbeddingSample'],
        rows: chunks,
        rowCount: chunks.length,
        message: `Command(s) completed successfully. (${chunks.length} of ${this.chunks.size} chunk(s) displayed)`,
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    if (cleanQuery.includes('SP_VECTORSTATS') || cleanQuery.includes('STATS')) {
      return {
        columns: ['Metric', 'Value', 'Details'],
        rows: [
          { Metric: 'Total Indexed Documents', Value: this.documents.size, Details: 'Documents stored in dbo.Documents' },
          { Metric: 'Total Vector Chunks', Value: this.chunks.size, Details: 'Stored in dbo.DocumentChunks with VECTOR(768)' },
          { Metric: 'Index Type', Value: 'DiskANN Vector Index', Details: 'Cosine metric distance with 768 dimensions' },
          { Metric: 'MS SQL Server Compatibility', Value: 'v2025 / Azure SQL', Details: 'Native VECTOR data type enabled' },
        ],
        rowCount: 4,
        message: 'Database vector statistics retrieved successfully.',
        executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
      };
    }

    // Default response for other queries
    return {
      columns: ['Status', 'Info'],
      rows: [{ Status: 'Executed', Info: `Query processed against in-memory MS SQL Server vector catalog.` }],
      rowCount: 1,
      message: 'Query executed successfully.',
      executionTimeMs: Number((performance.now() - startTime).toFixed(2)),
    };
  }

  /**
   * Seeds enterprise policy and architecture documents so users can test immediately
   */
  private seedDefaultData() {
    const doc1Id = 'doc-sla-2026';
    const doc1: DocumentRecord = {
      DocumentId: doc1Id,
      FileName: 'Cloud_Infrastructure_SLA_and_DR_Policy_2026.pdf',
      FileType: 'pdf',
      FileSize: 142800,
      ChunkCount: 3,
      TotalTokens: 480,
      CreatedAt: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
      Status: 'Indexed',
    };

    const doc1ChunksText = [
      `Section 1: Enterprise Cloud High Availability & SLA Targets.
The cloud infrastructure guarantees 99.99% monthly availability for all production microservices and MS SQL Server clusters. Maintenance windows are scheduled exclusively on Sundays between 02:00 and 04:00 UTC with a minimum 72-hour advance advisory notification to stakeholders.`,
      `Section 2: Disaster Recovery & Continuity Objectives.
The Recovery Point Objective (RPO) is strictly 15 minutes, achieved through synchronous transaction log shipping and geo-replicated vector stores. The Recovery Time Objective (RTO) is 60 minutes for full regional failover to Azure East US 2. Vector search indexes are continuously synchronized using change data capture (CDC).`,
      `Section 3: Incident Severity Classification and Response Tiers.
Priority 1 (Critical Outage): Immediate response within 15 minutes, war room activation, and 30-minute status updates. Priority 2 (Degraded Performance): Response within 1 hour. Priority 3 (Standard Inquiries): Response within 4 business hours. Automated health-check probes run every 10 seconds.`,
    ];

    this.insertDocument(doc1);
    doc1ChunksText.forEach((content, idx) => {
      this.chunks.set(`${doc1Id}-chunk-${idx}`, {
        ChunkId: `${doc1Id}-chunk-${idx}`,
        DocumentId: doc1Id,
        FileName: doc1.FileName,
        ChunkIndex: idx,
        Content: content,
        TokenCount: Math.round(content.length / 4),
        Embedding: generateDeterministicEmbedding(content),
        Norm: 1.0,
        CreatedAt: doc1.CreatedAt,
      });
    });

    const doc2Id = 'doc-hr-leave';
    const doc2: DocumentRecord = {
      DocumentId: doc2Id,
      FileName: 'Global_Employee_Benefits_and_Leave_Handbook_2026.docx',
      FileType: 'docx',
      FileSize: 89400,
      ChunkCount: 3,
      TotalTokens: 420,
      CreatedAt: new Date(Date.now() - 3600 * 48 * 1000).toISOString(),
      Status: 'Indexed',
    };

    const doc2ChunksText = [
      `Chapter 3: Paid Time Off (PTO) and Vacation Accrual.
Full-time enterprise personnel receive 25 days of paid annual leave per calendar year. A maximum of 5 unused leave days can be carried over into the subsequent fiscal year with manager approval. Emergency leaves of up to 5 consecutive days do not require prior notice but must be logged within 48 hours.`,
      `Chapter 5: Parental, Family, and Caregiver Leave Policy.
All primary caregivers are entitled to 16 consecutive weeks of fully paid parental leave following childbirth, adoption, or foster placement. Secondary caregivers receive 8 weeks of fully paid leave. Employees may also request phased return-to-work schedules at 80% capacity for the first month.`,
      `Chapter 7: Wellness Stipends and Remote Work Equipment Allowance.
Employees are eligible for an annual health and wellness reimbursement of $1,500 USD for gym memberships, mental health apps, and athletic equipment. Remote personnel receive a one-time ergonomic home office stipend of $1,000 USD to procure approved desks, chairs, and monitors.`,
    ];

    this.insertDocument(doc2);
    doc2ChunksText.forEach((content, idx) => {
      this.chunks.set(`${doc2Id}-chunk-${idx}`, {
        ChunkId: `${doc2Id}-chunk-${idx}`,
        DocumentId: doc2Id,
        FileName: doc2.FileName,
        ChunkIndex: idx,
        Content: content,
        TokenCount: Math.round(content.length / 4),
        Embedding: generateDeterministicEmbedding(content),
        Norm: 1.0,
        CreatedAt: doc2.CreatedAt,
      });
    });

    const doc3Id = 'doc-sec-soc';
    const doc3: DocumentRecord = {
      DocumentId: doc3Id,
      FileName: 'Cybersecurity_Incident_Response_SOC_Playbook.txt',
      FileType: 'txt',
      FileSize: 65200,
      ChunkCount: 2,
      TotalTokens: 310,
      CreatedAt: new Date(Date.now() - 3600 * 72 * 1000).toISOString(),
      Status: 'Indexed',
    };

    const doc3ChunksText = [
      `Playbook Item 1: Threat Containment and Network Isolation Protocol.
Upon detection of unauthorized access or anomalous SQL injection attempts, the SOC engineer must immediately isolate the affected subnet and revoke compromised JWT tokens within 5 minutes. The MS SQL Server instance must be switched to read-only replica mode while volatile memory dumps are captured for forensic analysis.`,
      `Playbook Item 2: Regulatory Disclosure and Post-Mortem Obligations.
If personal identifiable data (PII) is compromised, legal counsel must be alerted immediately. Formal regulatory disclosure must occur within 72 hours under GDPR Article 33. A comprehensive Root Cause Analysis (RCA) document must be published within 5 business days detailing remediation milestones and preventive safeguards.`,
    ];

    this.insertDocument(doc3);
    doc3ChunksText.forEach((content, idx) => {
      this.chunks.set(`${doc3Id}-chunk-${idx}`, {
        ChunkId: `${doc3Id}-chunk-${idx}`,
        DocumentId: doc3Id,
        FileName: doc3.FileName,
        ChunkIndex: idx,
        Content: content,
        TokenCount: Math.round(content.length / 4),
        Embedding: generateDeterministicEmbedding(content),
        Norm: 1.0,
        CreatedAt: doc3.CreatedAt,
      });
    });
  }
}

/**
 * Generates a normalized 768-dimensional deterministic vector embedding for text.
 * Used for instant vector index bootstrap and reliable fallback.
 */
export function generateDeterministicEmbedding(text: string, dimensions = 768): number[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  const vec = new Float64Array(dimensions);

  // Bag of words + n-gram semantic hashing
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = (hash << 5) - hash + word.charCodeAt(c);
      hash |= 0;
    }
    const idx1 = Math.abs(hash) % dimensions;
    const idx2 = Math.abs((hash * 31) ^ (i * 17)) % dimensions;
    vec[idx1] += 1.0 / Math.sqrt(word.length + 1);
    vec[idx2] += 0.5;

    // Bigram
    if (i < words.length - 1) {
      const bigram = word + '_' + words[i + 1];
      let bHash = 0;
      for (let c = 0; c < bigram.length; c++) {
        bHash = (bHash << 5) - bHash + bigram.charCodeAt(c);
        bHash |= 0;
      }
      const bIdx = Math.abs(bHash) % dimensions;
      vec[bIdx] += 1.2;
    }
  }

  // Normalize to unit vector
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    sumSq += vec[i] * vec[i];
  }

  const norm = Math.sqrt(sumSq) || 1;
  const result: number[] = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    result[i] = Number((vec[i] / norm).toFixed(6));
  }
  return result;
}

export const mssqlVectorEngine = new MsSqlVectorEngine();
