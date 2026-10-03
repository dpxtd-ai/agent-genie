namespace MsSqlVectorRag.Models;

public class DocumentRecord
{
    public Guid DocumentId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public int ChunkCount { get; set; }
    public int TotalTokens { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "Indexed";
}

public class DocumentChunkRecord
{
    public Guid ChunkId { get; set; }
    public Guid DocumentId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    public string Content { get; set; } = string.Empty;
    public int TokenCount { get; set; }
    public float[] Embedding { get; set; } = Array.Empty<float>();
    public DateTime CreatedAt { get; set; }
}

public class SearchResultChunk
{
    public Guid ChunkId { get; set; }
    public Guid DocumentId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public int ChunkIndex { get; set; }
    public string Content { get; set; } = string.Empty;
    public double Distance { get; set; }
    public double SimilarityScore { get; set; }
}

public class RagQueryRequest
{
    public string Query { get; set; } = string.Empty;
    public int? TopK { get; set; } = 4;
    public float? SimilarityThreshold { get; set; } = 0.20f;
    public List<ChatMessageItem>? ChatHistory { get; set; }
}

public class ChatMessageItem
{
    public string Role { get; set; } = "user";
    public string Text { get; set; } = string.Empty;
}

public class RagQueryResponse
{
    public string Answer { get; set; } = string.Empty;
    public string? ClarificationQuestion { get; set; }
    public bool HasClarification { get; set; }
    public List<SearchResultChunk> RetrievedChunks { get; set; } = new();
    public string SqlExecutionQuery { get; set; } = string.Empty;
    public int TotalChunksScanned { get; set; }
    public double SearchTimeMs { get; set; }
    public double LlmTimeMs { get; set; }
    public string ModelUsed { get; set; } = string.Empty;
    public double ConfidenceScore { get; set; }
    public float[] QueryVectorSample { get; set; } = Array.Empty<float>();
}
