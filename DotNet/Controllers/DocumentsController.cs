using Microsoft.AspNetCore.Mvc;
using MsSqlVectorRag.Models;
using MsSqlVectorRag.Services;

namespace MsSqlVectorRag.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentParserService _parser;
    private readonly IGeminiService _gemini;
    private readonly IMsSqlVectorService _vectorDb;

    public DocumentsController(
        IDocumentParserService parser,
        IGeminiService gemini,
        IMsSqlVectorService vectorDb)
    {
        _parser = parser;
        _gemini = gemini;
        _vectorDb = vectorDb;
    }

    /// <summary>
    /// Uploads a file (PDF, Word DOCX, Text), chunks it, generates Gemini vectors, and stores into MS SQL Server.
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UploadDocument([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        try
        {
            using var stream = file.OpenReadStream();

            // 1. Extract raw text from file
            var extractedText = await _parser.ExtractTextAsync(stream, file.FileName);
            if (string.IsNullOrWhiteSpace(extractedText))
                return BadRequest(new { error = "Could not extract text from document." });

            // 2. Semantic chunking
            var chunks = _parser.ChunkText(extractedText, targetChunkChars: 600, overlapChars: 100);

            var docId = Guid.NewGuid();
            var createdAt = DateTime.UtcNow;

            var document = new DocumentRecord
            {
                DocumentId = docId,
                FileName = file.FileName,
                FileType = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant(),
                FileSize = file.Length,
                ChunkCount = chunks.Count,
                TotalTokens = extractedText.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length,
                CreatedAt = createdAt,
                Status = "Indexed"
            };

            // 3. Generate Gemini vector embeddings for each chunk
            var chunkRecords = new List<DocumentChunkRecord>();
            for (int i = 0; i < chunks.Count; i++)
            {
                var chunkText = chunks[i];
                var vector = await _gemini.GenerateEmbeddingAsync(chunkText);

                chunkRecords.Add(new DocumentChunkRecord
                {
                    ChunkId = Guid.NewGuid(),
                    DocumentId = docId,
                    FileName = file.FileName,
                    ChunkIndex = i,
                    Content = chunkText,
                    TokenCount = (int)Math.Round(chunkText.Length / 4.0),
                    Embedding = vector,
                    CreatedAt = createdAt
                });
            }

            // 4. Save to MS SQL Server
            await _vectorDb.SaveDocumentWithVectorsAsync(document, chunkRecords);

            return Ok(new
            {
                success = true,
                document,
                chunksCreated = chunkRecords.Count,
                message = $"Successfully converted {file.FileName} into vector format and stored in MS SQL Server."
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
                message = "The .NET backend failed to connect to Gemini Embedding service. Please check your internet connectivity and ensure Gemini:ApiKey is configured in /DotNet/appsettings.json.",
                details = httpEx.Message
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                errorCode = "ERR_INTERNAL_SERVER",
                error = "Failed to upload and vectorize document",
                message = ex.Message
            });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetDocuments()
    {
        var docs = await _vectorDb.GetDocumentsAsync();
        return Ok(docs);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDocument(Guid id)
    {
        var doc = await _vectorDb.GetDocumentByIdAsync(id);
        if (doc == null) return NotFound(new { error = "Document not found." });

        var chunks = await _vectorDb.GetChunksByDocumentIdAsync(id);
        return Ok(new { document = doc, chunks });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDocument(Guid id)
    {
        var success = await _vectorDb.DeleteDocumentAsync(id);
        if (!success) return NotFound(new { error = "Document not found." });

        return Ok(new { success = true, message = "Document and vector embeddings deleted from MS SQL Server." });
    }
}
