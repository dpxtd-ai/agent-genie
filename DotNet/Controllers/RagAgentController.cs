using Microsoft.AspNetCore.Mvc;
using MsSqlVectorRag.Models;
using MsSqlVectorRag.Services;

namespace MsSqlVectorRag.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RagAgentController : ControllerBase
{
    private readonly IGeminiService _gemini;
    private readonly IMsSqlVectorService _vectorDb;

    public RagAgentController(IGeminiService gemini, IMsSqlVectorService vectorDb)
    {
        _gemini = gemini;
        _vectorDb = vectorDb;
    }

    /// <summary>
    /// Communicates with Agent:
    /// 1. Converts question to vector.
    /// 2. Queries MS SQL Server for matching vectors using cosine distance.
    /// 3. Sends grounded prompt to Gemini LLM.
    /// 4. Returns response with citations and clarifying questions to Angular UI.
    /// </summary>
    [HttpPost("chat")]
    public async Task<IActionResult> ChatWithAgent([FromBody] RagQueryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
            return BadRequest(new { error = "Query is required." });

        var t0 = DateTime.UtcNow;

        try
        {
            // Step 1: Convert user question into dense vector format
            float[] queryVector = await _gemini.GenerateEmbeddingAsync(request.Query.Trim());

            var tVector = DateTime.UtcNow;

            // Step 2: Query MS SQL Server to fetch existing vectors and compare (VECTOR_DISTANCE)
            var retrievedChunks = await _vectorDb.SearchSimilarChunksAsync(
                queryVector, 
                topK: request.TopK ?? 4, 
                minSimilarity: request.SimilarityThreshold ?? 0.20f);

            var tSql = DateTime.UtcNow;
            var searchDurationMs = (tSql - tVector).TotalMilliseconds;

            // Step 3: Format grounded context block
            string contextBlock;
            if (retrievedChunks.Count > 0)
            {
                contextBlock = string.Join("\n\n", retrievedChunks.Select((c, idx) =>
                    $"[Source: {c.FileName} | Chunk #{c.ChunkIndex + 1} | Similarity: {(c.SimilarityScore * 100):F1}%]:\n{c.Content}"));
            }
            else
            {
                contextBlock = "No directly matching vector chunks found in MS SQL Server.";
            }

            // Step 4: Send actual prompt with vector context to Gemini LLM
            var tLlmStart = DateTime.UtcNow;
            var (answer, clarificationQuestion) = await _gemini.GenerateRagAnswerAsync(
                request.Query, 
                contextBlock, 
                request.ChatHistory);

            var llmDurationMs = (DateTime.UtcNow - tLlmStart).TotalMilliseconds;

            string queryVectorSample = $"[{string.Join(", ", queryVector.Take(4).Select(f => f.ToString("F3")))}... (768 dims)]";
            string sqlQueryExecuted = $@"
DECLARE @QueryVector VECTOR(768) = '{queryVectorSample}';
SELECT TOP ({request.TopK ?? 4}) 
    c.ChunkId, d.FileName, c.Content,
    VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector) AS VectorDistance,
    (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector)) AS SimilarityScore
FROM dbo.DocumentChunks c WITH (INDEX(IX_DocumentChunks_Embedding_DiskANN))
INNER JOIN dbo.Documents d ON c.DocumentId = d.DocumentId
WHERE (1.0 - VECTOR_DISTANCE('cosine', c.Embedding, @QueryVector)) >= {request.SimilarityThreshold ?? 0.20f:F2}
ORDER BY VectorDistance ASC;".Trim();

            var topSimilarity = retrievedChunks.Count > 0 ? retrievedChunks[0].SimilarityScore : 0.0;

            // Step 5: Return response to Angular UI
            return Ok(new RagQueryResponse
            {
                Answer = answer,
                ClarificationQuestion = clarificationQuestion,
                HasClarification = !string.IsNullOrEmpty(clarificationQuestion),
                RetrievedChunks = retrievedChunks,
                SqlExecutionQuery = sqlQueryExecuted,
                TotalChunksScanned = retrievedChunks.Count,
                SearchTimeMs = Math.Round(searchDurationMs, 2),
                LlmTimeMs = Math.Round(llmDurationMs, 2),
                ModelUsed = "gemini-embedding-2-preview + gemini-3.8-flash",
                ConfidenceScore = Math.Round(topSimilarity, 2),
                QueryVectorSample = queryVector.Take(8).ToArray()
            });
        }
        catch (Microsoft.Data.SqlClient.SqlException sqlEx)
        {
            return StatusCode(503, new
            {
                errorCode = "ERR_DATABASE_UNAVAILABLE",
                error = "Unable to connect to MS SQL Server Database",
                message = "The .NET backend cannot establish a connection to your MS SQL Server instance. Please verify that SQL Server is running and check your connection string in /DotNet/appsettings.json.",
                details = sqlEx.Message
            });
        }
        catch (HttpRequestException httpEx)
        {
            return StatusCode(503, new
            {
                errorCode = "ERR_GEMINI_UNAVAILABLE",
                error = "Unable to connect to Google Gemini AI service",
                message = "The .NET backend failed to communicate with Gemini API. Please check your internet connectivity and ensure Gemini:ApiKey is configured in /DotNet/appsettings.json.",
                details = httpEx.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                errorCode = "ERR_INTERNAL_SERVER",
                error = "Internal server error during RAG execution",
                message = ex.Message
            });
        }
    }
}
