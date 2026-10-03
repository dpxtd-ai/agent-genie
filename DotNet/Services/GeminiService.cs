using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MsSqlVectorRag.Models;

namespace MsSqlVectorRag.Services;

public interface IGeminiService
{
    Task<float[]> GenerateEmbeddingAsync(string text);
    Task<(string Answer, string? ClarificationQuestion)> GenerateRagAnswerAsync(
        string query, 
        string context, 
        List<ChatMessageItem>? history = null);
}

public class GeminiService : IGeminiService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _embeddingModel;
    private readonly string _chatModel;

    public GeminiService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _apiKey = config["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? "";
        _embeddingModel = config["Gemini:EmbeddingModel"] ?? "gemini-embedding-2-preview";
        _chatModel = config["Gemini:ChatModel"] ?? "gemini-3.8-flash";

        _http.DefaultRequestHeaders.Add("User-Agent", "aistudio-build");
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY")
        {
            // Deterministic 768-dimension semantic fallback
            return GenerateDeterministicEmbedding(text, 768);
        }

        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_embeddingModel}:embedContent?key={_apiKey}";
            var payload = new
            {
                model = $"models/{_embeddingModel}",
                content = new { parts = new[] { new { text } } }
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("embedding", out var emb) &&
                    emb.TryGetProperty("values", out var vals))
                {
                    var list = new List<float>();
                    foreach (var val in vals.EnumerateArray())
                    {
                        list.Add(val.GetSingle());
                    }
                    return list.ToArray();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Gemini embedding call failed: {ex.Message}");
        }

        return GenerateDeterministicEmbedding(text, 768);
    }

    public async Task<(string Answer, string? ClarificationQuestion)> GenerateRagAnswerAsync(
        string query, 
        string context, 
        List<ChatMessageItem>? history = null)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey == "YOUR_GEMINI_API_KEY")
        {
            return ($"Retrieved from MS SQL Server Vector Catalog:\n\n{context}", 
                    "Would you like more details on specific policies or requirements?");
        }

        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_chatModel}:generateContent?key={_apiKey}";

            var historyBlock = history != null && history.Count > 0
                ? "Recent Conversation:\n" + string.Join("\n", history.TakeLast(4).Select(h => $"{h.Role}: {h.Text}")) + "\n\n"
                : "";

            var promptText = $@"
{historyBlock}User Question:
""{query}""

Retrieved Context from MS SQL Server 2025 Vector Store:
""""""
{context}
""""""

Instructions:
1. Check if the user's question can be answered from the retrieved document context above.
2. If YES (the context contains relevant enterprise document information):
   - Provide a comprehensive, professional answer grounded in the retrieved chunks.
   - Cite the source files and chunk indices clearly.
3. If NO or UNRELATED (such as general knowledge questions like 'what is the capital of india?', geography, science, math, or topics not in uploaded files):
   - Answer the question accurately and authoritatively using your general LLM knowledge.
   - You MUST prepend the response with this exact note:
   > 💡 **Note:** This answer is provided directly by the AI model (LLM knowledge) because no matching or relevant content was found in the indexed MS SQL documents.
   - Do NOT cite or force unrelated document chunks into your answer.
4. If you have a follow-up or clarifying question to ask the user, put it at the very end under the header: '### Clarifying Question for You:'
".Trim();

            var payload = new
            {
                contents = new[]
                {
                    new { role = "user", parts = new[] { new { text = promptText } } }
                },
                systemInstruction = new
                {
                    parts = new[] { new { text = "You are an expert enterprise AI Agent powered by Google Gemini and a .NET 9 + MS SQL Server Vector RAG backend. Provide grounded answers and proactively ask clarifying questions when needed." } }
                },
                generationConfig = new
                {
                    temperature = 0.2,
                    thinkingConfig = new { thinkingLevel = "LOW" }
                }
            };

            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(url, content);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var candidates = doc.RootElement.GetProperty("candidates");
                var rawText = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? "";

                var match = Regex.Match(rawText, @"### Clarifying Question for You:\s*([\s\S]*)$", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var clarification = match.Groups[1].Value.Trim();
                    var answer = Regex.Replace(rawText, @"### Clarifying Question for You:\s*[\s\S]*$", "", RegexOptions.IgnoreCase).Trim();
                    return (answer, clarification);
                }

                return (rawText, null);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Gemini generateContent error: {ex.Message}");
        }

        return ($"Based on MS SQL Server Vector Catalog:\n\n{context}", 
                "Do you need more information on any specific section?");
    }

    private static float[] GenerateDeterministicEmbedding(string text, int dimensions)
    {
        var clean = text.ToLowerInvariant();
        var words = clean.Split(new[] { ' ', '\t', '\n', '\r', ',', '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries);
        var vec = new float[dimensions];

        for (int i = 0; i < words.Length; i++)
        {
            var word = words[i];
            int hash = 17;
            foreach (char c in word) hash = hash * 31 + c;
            int idx1 = Math.Abs(hash) % dimensions;
            int idx2 = Math.Abs((hash * 37) ^ (i * 19)) % dimensions;
            vec[idx1] += 1.0f / (float)Math.Sqrt(word.Length + 1);
            vec[idx2] += 0.5f;
        }

        float sumSq = 0;
        for (int i = 0; i < dimensions; i++) sumSq += vec[i] * vec[i];
        float norm = (float)Math.Sqrt(sumSq);
        if (norm > 0)
        {
            for (int i = 0; i < dimensions; i++) vec[i] /= norm;
        }

        return vec;
    }
}
