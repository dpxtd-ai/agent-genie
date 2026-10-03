-- =========================================================================================
-- MS SQL SERVER 2025 VECTOR DATABASE SCHEMA
-- Target: Local PC MS SQL Server or Public MS SQL Server instance
-- =========================================================================================

USE master;
GO

-- 1. Create Database if not exists
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'EnterpriseVectorDb')
BEGIN
    CREATE DATABASE EnterpriseVectorDb;
END;
GO

USE EnterpriseVectorDb;
GO

-- 2. Documents Master Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Documents')
BEGIN
    CREATE TABLE dbo.Documents (
        DocumentId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        FileName NVARCHAR(255) NOT NULL,
        FileType NVARCHAR(20) NOT NULL,
        FileSize BIGINT NOT NULL,
        ChunkCount INT NOT NULL DEFAULT 0,
        TotalTokens INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(50) NOT NULL DEFAULT 'Indexed'
    );
END;
GO

-- 3. Document Chunks Table with Native VECTOR(768)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DocumentChunks')
BEGIN
    CREATE TABLE dbo.DocumentChunks (
        ChunkId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        DocumentId UNIQUEIDENTIFIER NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        ChunkIndex INT NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        TokenCount INT NOT NULL DEFAULT 0,
        -- Native 768-dimension vector column
        Embedding VECTOR(768) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_DocumentChunks_Documents FOREIGN KEY (DocumentId) 
            REFERENCES dbo.Documents(DocumentId) ON DELETE CASCADE
    );

    -- 4. Create DiskANN Vector Index for millisecond Approximate Nearest Neighbor lookup
    CREATE VECTOR INDEX IX_DocumentChunks_Embedding_DiskANN 
    ON dbo.DocumentChunks(Embedding)
    WITH (
        METRIC = 'COSINE',
        ALGORITHM = 'DiskANN'
    );
END;
GO

-- 5. Stored Procedure for Cosine Vector Retrieval
CREATE OR ALTER PROCEDURE dbo.sp_SearchDocumentVectors
    @QueryVector VECTOR(768),
    @TopK INT = 4,
    @MinSimilarity FLOAT = 0.20
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@TopK)
        c.ChunkId,
        c.DocumentId,
        d.FileName,
        c.ChunkIndex,
        c.Content,
        VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector) AS Distance,
        (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector)) AS SimilarityScore
    FROM dbo.DocumentChunks c WITH (INDEX(IX_DocumentChunks_Embedding_DiskANN))
    INNER JOIN dbo.Documents d ON c.DocumentId = d.DocumentId
    WHERE (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector)) >= @MinSimilarity
    ORDER BY Distance ASC;
END;
GO
