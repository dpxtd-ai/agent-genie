# 🧞 Agent Genie: Enterprise Vector RAG Platform
### Powered by Angular 19, ASP.NET Core 9, MS SQL Server 2025 Native Vector Engine & Google Gemini

---

## 📑 Table of Contents
1. [Executive Summary & Client Value Proposition](#1-executive-summary--client-value-proposition)
2. [Client Demo Script & Walkthrough (Business Perspective)](#2-client-demo-script--walkthrough-business-perspective)
3. [Technical Architecture & Data Flow](#3-technical-architecture--data-flow)
4. [MS SQL Server 2025 Vector Engine Deep-Dive](#4-ms-sql-server-2025-vector-engine-deep-dive)
5. [RAG Pipeline & Semantic Gating Mechanics](#5-rag-pipeline--semantic-gating-mechanics)
6. [Technical Demo & Live Verification Guide](#6-technical-demo--live-verification-guide)
7. [Deployment & CI/CD Pipelines](#7-deployment--cicd-pipelines)

---

## 1. Executive Summary & Client Value Proposition

**Agent Genie** is an enterprise-grade AI knowledge platform designed for corporate environments with strict data governance, compliance, and accuracy requirements. Unlike consumer AI wrappers that send proprietary documents to third-party vector databases, Agent Genie keeps your vector embeddings inside your existing **Microsoft SQL Server 2025** enterprise infrastructure.

### Key Business Benefits
* **Enterprise Data Sovereignty**: Document embeddings reside within your SQL Server database using Microsoft's native `VECTOR(768)` type—enforcing existing security, backup, encryption (TDE), and RBAC policies.
* **Zero-Hallucination Grounding**: Every document-based answer includes source attribution and similarity match percentages.
* **Proactive Clarifying Agent**: The agent automatically identifies ambiguities (such as severity tiers or caregiver roles) and proactively asks clarifying questions before giving incomplete advice.
* **Transparent Knowledge Fallback**: If a question falls outside indexed corporate policies (e.g. *"What is the capital of India?"*), the agent answers via general LLM knowledge while displaying an explicit visual badge clarifying that no internal corporate records were used.
* **Dual Deployment Architecture**:
  * **Interactive Frontend**: Angular 19 / Reactive UI (deployable to GitHub Pages or corporate CDN).
  * **Enterprise Backend**: ASP.NET Core 9 Web API (.NET 9) with high-throughput native SQL vector operations.

---

## 2. Client Demo Script & Walkthrough (Business Perspective)

Use this step-by-step script to conduct an impactful 10-minute client presentation.

### 🎬 Scene 1: Welcome & Enterprise Chat Interface
* **Action**: Open the **Agent Q&A** tab.
* **Talking Point**: *"Notice the clean, executive interface. The agent initializes with a clear explanation of its enterprise RAG workflow: embedding conversion, MS SQL Server cosine distance search, and Gemini synthesis."*

---

### 🎬 Scene 2: Grounded Document Query with Citations
* **Action**: Click the preset prompt or type:
  > **Query:** `What is our disaster recovery RPO and RTO SLA target?`
* **Result**:
  * **Answer**: RPO is 15 minutes, RTO is 60 minutes for regional failover.
  * **Citation**: Cites *Cloud_Infrastructure_SLA_and_DR_Policy_2026.pdf*, Section 2.
  * **Vector Match Badge**: Displays `80% match` retrieved via MS SQL Server `VECTOR_DISTANCE('cosine')`.
  * **Agent Clarification**: Prompts whether you need Priority 1 incident workflows or automated failover steps.
* **Talking Point**: *"The model does not guess. It extracts verified targets directly from indexed SLA contracts and cites the exact document part."*

---

### 🎬 Scene 3: Clarifying Question Interaction
* **Action**: Click the button **"Answer this clarification"** below the agent's question, or ask:
  > **Query:** `How many weeks of fully paid parental leave are primary caregivers entitled to?`
* **Result**: The agent clarifies the 16-week benefit for primary caregivers vs. 6 weeks for secondary caregivers and cites the *Global_Employee_Handbook_2026.docx*.
* **Talking Point**: *"Instead of giving a generic answer, the agent asks relevant clarifying questions, acting like a true enterprise colleague."*

---

### 🎬 Scene 4: Out-of-Domain General Knowledge (The "India" Query)
* **Action**: Ask a general question not present in corporate documents:
  > **Query:** `What is the capital of India?`
* **Result**:
  * **Blue Callout Badge**: `Direct LLM General Knowledge Response: No matching records were found. Answer from LLM.`
  * **Answer**: *"The capital of India is **New Delhi**."*
  * **Retrieved Chunks**: Zero irrelevant chunks attached (no unrelated SLA or HR docs forced into the answer).
* **Talking Point**: *"When an employee asks a non-company question, the agent answers accurately from general knowledge while explicitly stating that company documents were not used. No irrelevant corporate documents are forced into the response."*

---

### 🎬 Scene 5: Live Document Ingestion & Vector Indexing
* **Action**: Navigate to the **Document Manager** tab. Click **Upload Document**, select any `.pdf`, `.docx`, or `.txt` file, and upload.
* **Result**:
  * Document text is extracted and chunked.
  * 768-dimensional embeddings are generated.
  * Stored into MS SQL Server with T-SQL `INSERT` statements displayed on screen.
* **Talking Point**: *"New policies, SOPs, and contracts can be indexed in seconds without server restarts or external cloud vector databases."*

---

## 3. Technical Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                           PRESENTATION LAYER (CLIENT)                             |
|  Angular 19 / React SPA  *  Tailwind CSS  *  react-markdown  *  Lucide Icons     |
+-----------------------------------------+-----------------------------------------+
                                          | HTTP REST / JSON
                                          v
+-----------------------------------------------------------------------------------+
|                        APPLICATION LAYER (BACKEND SERVICES)                       |
|   ASP.NET Core 9 Web API (.NET 9)                Node.js Express Proxy            |
|   - DocumentParserService (PDF/DOCX/TXT)         - Server-side Gemini Client      |
|   - RagService & Semantic Gating                 - Live Health & Telemetry        |
|   - Swagger / OpenAPI Documentation              - Vite Production Middleware     |
+---------------------+-------------------------------------+-----------------------+
                      |                                     |
                      v                                     v
+----------------------------------+       +----------------------------------------+
|      DATABASE LAYER (MS SQL)     |       |          AI / LLM LAYER                |
|  MS SQL Server 2025              |       |  Google Gemini API                     |
|  - Table: dbo.Documents          |       |  - Model: gemini-embedding-2-preview   |
|  - Table: dbo.DocumentChunks     |       |    (768-dimensional vector space)      |
|  - Column: Embedding VECTOR(768) |       |  - Model: gemini-3.8-flash             |
|  - Index: DiskANN Vector Catalog |       |    (Low-latency grounded synthesis)    |
|  - Function: VECTOR_DISTANCE()   |       |  - Thinking Level: Low (enterprise)   |
+----------------------------------+       +----------------------------------------+
```

---

## 4. MS SQL Server 2025 Vector Engine Deep-Dive

Agent Genie utilizes Microsoft's latest native vector capabilities introduced in **MS SQL Server 2025**.

### 1. Table Schema Definition (`Schema.sql`)
```sql
CREATE TABLE dbo.Documents (
    DocumentId NVARCHAR(64) PRIMARY KEY,
    FileName NVARCHAR(256) NOT NULL,
    ContentType NVARCHAR(64) NOT NULL,
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.DocumentChunks (
    ChunkId NVARCHAR(64) PRIMARY KEY,
    DocumentId NVARCHAR(64) NOT NULL FOREIGN KEY REFERENCES dbo.Documents(DocumentId) ON DELETE CASCADE,
    ChunkIndex INT NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Embedding VECTOR(768) NOT NULL -- Native 768-dimensional float32 vector
);
```

### 2. High-Performance DiskANN Vector Indexing
```sql
-- Approximate Nearest Neighbor (ANN) Index using Microsoft DiskANN algorithm
CREATE VECTOR INDEX IX_DocumentChunks_Embedding_DiskANN 
ON dbo.DocumentChunks (Embedding) 
WITH (DISTANCE_METRIC = 'COSINE');
```

### 3. Native Vector Distance Search Query
```sql
DECLARE @QueryVector VECTOR(768) = CAST(@VectorParam AS VECTOR(768));
DECLARE @TopK INT = 4;
DECLARE @MinSimilarity FLOAT = 0.40;

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
```

---

## 5. RAG Pipeline & Semantic Gating Mechanics

```
                  +-----------------------------------+
                  |      User Query Enters System     |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  Generate 768-d Vector Embedding  |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  Query MS SQL Server 2025 DiskANN |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  Semantic Relevance Gating Check  |
                  |     (Max Similarity >= 0.40?)     |
                  +---------+---------------+---------+
                            |               |
                    YES     |               |    NO
                            v               v
            +-----------------------+   +------------------------------+
            | Grounded Vector Context|   | No Relevant Document Chunks  |
            +-----------+-----------+   +---------------+--------------+
                        |                               |
                        v                               v
            +-----------------------+   +------------------------------+
            | Synthesize Answer     |   | Direct LLM General Knowledge |
            | with Exact Citations  |   | + Prominent Notice Banner    |
            +-----------------------+   +------------------------------+
```

1. **Embedding Alignment**: Query text is converted to a 768-dimensional float array using `gemini-embedding-2-preview`.
2. **Semantic Gating**: If top chunk similarity is below `0.40`, the query is flagged as out-of-domain.
3. **Prompt Guardrails**: Gemini is instructed never to force irrelevant enterprise documents into general knowledge answers.
4. **Markdown Rendering**: Frontend utilizes `react-markdown` to format bold weights, lists, code tokens, and badges.

---

## 6. Technical Demo & Live Verification Guide

For technical architects and lead engineers evaluating the code:

### Check Health & Engine Readiness
```bash
curl -s http://localhost:3000/api/health | jq
```
*Expected Response:*
```json
{
  "status": "online",
  "geminiConfigured": true,
  "msSqlDatabase": {
    "status": "Ready",
    "vectorEngine": "MS SQL Server 2025 DiskANN Vector Catalog",
    "vectorDimensions": 768,
    "distanceMetric": "Cosine"
  }
}
```

### Test General Knowledge Fallback
```bash
curl -s -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"what is the capital of india?"}' | jq .answer
```
*Expected Output:*
Includes the note callout and correctly identifies **New Delhi** without returning SLA document chunks.

### Test Grounded Enterprise Query
```bash
curl -s -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What is our disaster recovery RPO and RTO SLA target?"}' | jq
```
*Expected Output:*
Returns exact citations to `Cloud_Infrastructure_SLA_and_DR_Policy_2026.pdf` with similarity scores $\ge 0.70$.

---

## 7. Deployment & CI/CD Pipelines

### Automated GitHub Actions (`.github/workflows/static.yml`)
The repository includes a multi-job GitHub Actions workflow triggered on every push:
1. **Job 1 (`deploy-angular`)**:
   * Sets up Node.js 20.
   * Runs `npm install --legacy-peer-deps`.
   * Builds the production bundle (`npm run build`).
   * Deploys directly to **GitHub Pages**.
2. **Job 2 (`build-dotnet`)**:
   * Sets up .NET 9 SDK (`dotnet-version: '9.0.x'`).
   * Runs `dotnet restore` & `dotnet build -c Release`.
   * Publishes standalone Web API binaries (`dotnet publish`).
   * Archives production release package as a downloadable artifact.

### Docker Multi-Container Run
To run the full stack locally with MS SQL Server:
```bash
docker compose up --build
```
* Services:
  * `mssql`: Microsoft SQL Server 2025 with native vector extensions.
  * `api`: ASP.NET Core 9 Web API.
  * `ui`: Angular / Reactive Studio frontend.

---

## 8. Summary Checklist for Client Presentation

| Phase | Duration | Focus Area | Key Takeaway |
| :--- | :--- | :--- | :--- |
| **1. Hook & Overview** | 2 min | Security & MS SQL Native Vectors | Your data never leaves your enterprise database. |
| **2. Live RAG Chat** | 3 min | Grounded search & SLA Citations | Transparent, verifiable answers with source part & % match. |
| **3. Proactive Agent** | 2 min | Clarifying questions | Proactively resolves ambiguities instead of hallucinating. |
| **4. Edge Cases** | 2 min | Out-of-domain prompt ("Capital of India") | Explicit disclosure when using general AI vs. company data. |
| **5. Technical Proof**| 1 min | SQL Engine & DiskANN Indexing | Standard T-SQL, standard backup, standard enterprise compliance. |
