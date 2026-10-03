using Microsoft.Data.SqlClient;
using Dapper;
using MsSqlVectorRag.Models;

namespace MsSqlVectorRag.Services;

public interface IMsSqlVectorService
{
    Task<List<DocumentRecord>> GetDocumentsAsync();
    Task<DocumentRecord?> GetDocumentByIdAsync(Guid documentId);
    Task<List<DocumentChunkRecord>> GetChunksByDocumentIdAsync(Guid documentId);
    Task SaveDocumentWithVectorsAsync(DocumentRecord doc, List<DocumentChunkRecord> chunks);
    Task<List<SearchResultChunk>> SearchSimilarChunksAsync(float[] queryVector, int topK = 4, float minSimilarity = 0.20f);
    Task<bool> DeleteDocumentAsync(Guid documentId);
}

public class MsSqlVectorService : IMsSqlVectorService
{
    private readonly string _connectionString;

    public MsSqlVectorService(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("MsSqlVectorDb") ?? 
            "Server=localhost,1433;Database=EnterpriseVectorDb;User Id=sa;Password=YourPassword123!;TrustServerCertificate=True;";
    }

    public async Task<List<DocumentRecord>> GetDocumentsAsync()
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        string sql = @"
            SELECT DocumentId, FileName, FileType, FileSize, ChunkCount, TotalTokens, CreatedAt, Status 
            FROM dbo.Documents 
            ORDER BY CreatedAt DESC;";

        var list = await conn.QueryAsync<DocumentRecord>(sql);
        return list.AsList();
    }

    public async Task<DocumentRecord?> GetDocumentByIdAsync(Guid documentId)
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        string sql = @"SELECT * FROM dbo.Documents WHERE DocumentId = @DocumentId;";
        return await conn.QueryFirstOrDefaultAsync<DocumentRecord>(sql, new { DocumentId = documentId });
    }

    public async Task<List<DocumentChunkRecord>> GetChunksByDocumentIdAsync(Guid documentId)
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        string sql = @"
            SELECT ChunkId, DocumentId, FileName, ChunkIndex, Content, TokenCount, CreatedAt 
            FROM dbo.DocumentChunks 
            WHERE DocumentId = @DocumentId 
            ORDER BY ChunkIndex ASC;";

        var list = await conn.QueryAsync<DocumentChunkRecord>(sql, new { DocumentId = documentId });
        return list.AsList();
    }

    public async Task SaveDocumentWithVectorsAsync(DocumentRecord doc, List<DocumentChunkRecord> chunks)
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();
        using var tx = conn.BeginTransaction();

        try
        {
            // 1. Insert Document Master
            string insertDocSql = @"
                INSERT INTO dbo.Documents (DocumentId, FileName, FileType, FileSize, ChunkCount, TotalTokens, CreatedAt, Status)
                VALUES (@DocumentId, @FileName, @FileType, @FileSize, @ChunkCount, @TotalTokens, @CreatedAt, @Status);";

            await conn.ExecuteAsync(insertDocSql, doc, tx);

            // 2. Insert Document Chunks with VECTOR(768)
            string insertChunkSql = @"
                INSERT INTO dbo.DocumentChunks (ChunkId, DocumentId, FileName, ChunkIndex, Content, TokenCount, Embedding, CreatedAt)
                VALUES (@ChunkId, @DocumentId, @FileName, @ChunkIndex, @Content, @TokenCount, CAST(@VectorString AS VECTOR(768)), @CreatedAt);";

            foreach (var chunk in chunks)
            {
                string vectorStr = $"[{string.Join(",", chunk.Embedding)}]";
                await conn.ExecuteAsync(insertChunkSql, new
                {
                    chunk.ChunkId,
                    chunk.DocumentId,
                    chunk.FileName,
                    chunk.ChunkIndex,
                    chunk.Content,
                    chunk.TokenCount,
                    VectorString = vectorStr,
                    chunk.CreatedAt
                }, tx);
            }

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public async Task<List<SearchResultChunk>> SearchSimilarChunksAsync(
        float[] queryVector, 
        int topK = 4, 
        float minSimilarity = 0.20f)
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        string vectorStr = $"[{string.Join(",", queryVector)}]";

        // Native MS SQL Server 2025 Vector Search Query with VECTOR_DISTANCE
        string sql = @"
            DECLARE @QueryVec VECTOR(768) = CAST(@VectorParam AS VECTOR(768));

            SELECT TOP (@TopK)
                c.ChunkId,
                c.DocumentId,
                d.FileName,
                c.ChunkIndex,
                c.Content,
                VECTOR_DISTANCE('cosine', c.Embedding, @QueryVec) AS Distance,
                (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVec)) AS SimilarityScore
            FROM dbo.DocumentChunks c WITH (INDEX(IX_DocumentChunks_Embedding_DiskANN))
            INNER JOIN dbo.Documents d ON c.DocumentId = d.DocumentId
            WHERE (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVec)) >= @MinSimilarity
            ORDER BY Distance ASC;";

        var results = await conn.QueryAsync<SearchResultChunk>(sql, new
        {
            VectorParam = vectorStr,
            TopK = topK,
            MinSimilarity = minSimilarity
        });

        return results.AsList();
    }

    public async Task<bool> DeleteDocumentAsync(Guid documentId)
    {
        using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        string sql = @"DELETE FROM dbo.Documents WHERE DocumentId = @DocumentId;";
        int rows = await conn.ExecuteAsync(sql, new { DocumentId = documentId });
        return rows > 0;
    }
}
