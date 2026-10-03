using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using MsSqlVectorRag.Services;

namespace MsSqlVectorRag.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IGeminiService _gemini;

    public HealthController(IConfiguration config, IGeminiService gemini)
    {
        _config = config;
        _gemini = gemini;
    }

    [HttpGet]
    public async Task<IActionResult> GetHealth()
    {
        var timestamp = DateTime.UtcNow.ToString("o");
        var connStr = _config.GetConnectionString("MsSqlVectorDb") ?? "";
        
        // 1. Check MS SQL Server Connection
        bool dbConnected = false;
        string dbError = string.Empty;
        try
        {
            using var conn = new SqlConnection(connStr);
            await conn.OpenAsync();
            using var cmd = new SqlCommand("SELECT 1", conn);
            await cmd.ExecuteScalarAsync();
            dbConnected = true;
        }
        catch (Exception ex)
        {
            dbConnected = false;
            dbError = ex.Message;
        }

        // 2. Check Gemini AI Connection
        bool geminiConnected = false;
        string geminiError = string.Empty;
        var apiKey = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || apiKey == "YOUR_GEMINI_API_KEY")
        {
            geminiConnected = false;
            geminiError = "Gemini:ApiKey not configured in appsettings.json";
        }
        else
        {
            try
            {
                var sampleVector = await _gemini.GenerateEmbeddingAsync("health check");
                geminiConnected = sampleVector != null && sampleVector.Length > 0;
            }
            catch (Exception ex)
            {
                geminiConnected = false;
                geminiError = ex.Message;
            }
        }

        var overallHealthy = dbConnected && geminiConnected;

        var result = new
        {
            status = overallHealthy ? "Healthy" : "Degraded",
            timestamp,
            dotnetApi = new { status = "Online", framework = ".NET 9.0" },
            msSqlDatabase = new
            {
                status = dbConnected ? "Connected" : "Disconnected",
                message = dbConnected ? "MS SQL Server 2025 Vector Engine Ready" : $"Unable to connect to MS SQL Server: {dbError}"
            },
            geminiAi = new
            {
                status = geminiConnected ? "Connected" : "Disconnected",
                message = geminiConnected ? "Gemini Embeddings and LLM Ready" : $"Unable to connect to Gemini: {geminiError}"
            }
        };

        return Ok(result);
    }
}
